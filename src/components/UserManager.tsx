// src/components/UserManager.tsx
import { useState, useCallback } from "react";
import {
  Users, Plus, Edit3, Trash2, Eye, EyeOff,
  ShieldCheck, User, Save, X, AlertCircle, CheckCircle,
} from "lucide-react";
import { AppState } from "../types";
import { generateId } from "../store";

// ============================
// Types
// ============================
export interface AppUser {
  id: string;
  name: string;
  username: string;
  password: string;
  role: "admin" | "employee";
  permissions?: string[];
  createdAt?: string;
  isActive?: boolean;
}

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
}

// ============================
// الصلاحيات المتاحة
// ============================
const ALL_PERMISSIONS: { key: string; label: string; group: string }[] = [
  { key: "view_dashboard",    label: "عرض لوحة التحكم",     group: "عام" },
  { key: "view_reports",      label: "عرض التقارير",         group: "عام" },
  { key: "create_sale",       label: "إنشاء فواتير بيع",    group: "فواتير" },
  { key: "create_purchase",   label: "إنشاء فواتير شراء",   group: "فواتير" },
  { key: "create_maintenance",label: "إنشاء فواتير صيانة",  group: "فواتير" },
  { key: "create_accessory",  label: "فواتير اكسسوارات",    group: "فواتير" },
  { key: "create_installment",label: "استلام أقساط",         group: "فواتير" },
  { key: "view_registry",     label: "عرض سجل الفواتير",    group: "فواتير" },
  { key: "delete_invoice",    label: "حذف الفواتير",         group: "فواتير" },
  { key: "view_products",     label: "عرض المنتجات",         group: "المنتجات" },
  { key: "edit_products",     label: "تعديل المنتجات",       group: "المنتجات" },
  { key: "view_customers",    label: "عرض العملاء",          group: "العملاء" },
  { key: "view_treasury",     label: "عرض الخزنة",           group: "مالي" },
];

// ============================
// FormData الافتراضي
// ============================
const EMPTY_FORM: Partial<AppUser> = {
  name: "",
  username: "",
  password: "",
  role: "employee",
  permissions: [],
  isActive: true,
};

// ============================
// المكوّن الرئيسي
// ============================
export default function UserManager({ state, onUpdate }: Props) {
  // ✅ قراءة المستخدمين من state مباشرة
  const users: AppUser[] = Array.isArray(state?.users) ? state.users : [];

  const [showForm, setShowForm]       = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [formData, setFormData]       = useState<Partial<AppUser>>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError]     = useState("");
  const [saveStatus, setSaveStatus]   = useState<"idle" | "saving" | "saved" | "error">("idle");

  // ============================
  // Helpers
  // ============================
  const resetForm = useCallback(() => {
    setFormData(EMPTY_FORM);
    setFormError("");
    setShowPassword(false);
    setEditingUser(null);
  }, []);

  const openAdd = useCallback(() => {
    resetForm();
    setShowForm(true);
  }, [resetForm]);

  const openEdit = useCallback((user: AppUser) => {
    setFormData({
      name:        user.name,
      username:    user.username,
      password:    user.password,
      role:        user.role,
      permissions: user.permissions ?? [],
      isActive:    user.isActive !== false,
    });
    setEditingUser(user);
    setFormError("");
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    resetForm();
  }, [resetForm]);

  // ============================
  // ✅ الحفظ المُصلَح
  // ============================
  const handleSave = useCallback(() => {
    setFormError("");

    // — التحقق من البيانات —
    if (!formData.name?.trim()) {
      setFormError("الاسم الكامل مطلوب");
      return;
    }
    if (!formData.username?.trim()) {
      setFormError("اسم المستخدم مطلوب");
      return;
    }
    if (!formData.password?.trim() || formData.password.trim().length < 4) {
      setFormError("كلمة المرور يجب أن تكون 4 أحرف على الأقل");
      return;
    }

    // — التحقق من تكرار اسم المستخدم —
    const duplicate = users.some(
      (u) =>
        u.username.toLowerCase().trim() ===
          formData.username!.toLowerCase().trim() &&
        u.id !== editingUser?.id
    );
    if (duplicate) {
      setFormError("اسم المستخدم مستخدم بالفعل");
      return;
    }

    setSaveStatus("saving");

    try {
      let updatedUsers: AppUser[];

      if (editingUser) {
        // — تعديل مستخدم موجود —
        updatedUsers = users.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                name:        formData.name!.trim(),
                username:    formData.username!.trim(),
                password:    formData.password!.trim(),
                role:        formData.role ?? "employee",
                permissions: formData.permissions ?? [],
                isActive:    formData.isActive !== false,
              }
            : u
        );
      } else {
        // — إضافة مستخدم جديد —
        const newUser: AppUser = {
          id:          generateId(),
          name:        formData.name!.trim(),
          username:    formData.username!.trim(),
          password:    formData.password!.trim(),
          role:        formData.role ?? "employee",
          permissions: formData.permissions ?? [],
          isActive:    formData.isActive !== false,
          createdAt:   new Date().toLocaleString("ar-EG"),
        };
        updatedUsers = [...users, newUser];
      }

      // ✅ بناء الحالة الكاملة مع المستخدمين المحدّثين
      const newState: AppState = {
        ...state,
        users: updatedUsers,
      };

      // ✅ خطوة 1: الحفظ المباشر في localStorage أولاً
      const serialized = JSON.stringify(newState);
      localStorage.setItem("appState", serialized);

      // ✅ خطوة 2: تحديث الـ React state
      onUpdate(newState);

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
      closeForm();
    } catch (err) {
      console.error("UserManager.handleSave error:", err);
      setSaveStatus("error");
      setFormError("حدث خطأ أثناء الحفظ، حاول مرة أخرى");
    }
  }, [formData, editingUser, users, state, onUpdate, closeForm]);

  // ============================
  // ✅ الحذف المُصلَح
  // ============================
  const handleDelete = useCallback(
    (userId: string) => {
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      // منع حذف المدير الأخير
      if (
        user.role === "admin" &&
        users.filter((u) => u.role === "admin").length <= 1
      ) {
        alert("لا يمكن حذف المدير الوحيد في النظام");
        return;
      }
      if (!window.confirm(`هل أنت متأكد من حذف "${user.name}"؟`)) return;

      const updatedUsers = users.filter((u) => u.id !== userId);
      const newState: AppState = { ...state, users: updatedUsers };

      // ✅ حفظ مباشر
      localStorage.setItem("appState", JSON.stringify(newState));
      onUpdate(newState);
    },
    [users, state, onUpdate]
  );

  // ============================
  // Toggle Permission
  // ============================
  const togglePermission = useCallback((key: string) => {
    setFormData((prev) => {
      const current = prev.permissions ?? [];
      return {
        ...prev,
        permissions: current.includes(key)
          ? current.filter((p) => p !== key)
          : [...current, key],
      };
    });
  }, []);

  // تجميع الصلاحيات حسب المجموعة
  const permissionGroups = ALL_PERMISSIONS.reduce<Record<string, typeof ALL_PERMISSIONS>>(
    (acc, p) => {
      if (!acc[p.group]) acc[p.group] = [];
      acc[p.group].push(p);
      return acc;
    },
    {}
  );

  // ============================
  // Render
  // ============================
  return (
    <div className="space-y-6" dir="rtl">

      {/* ===== HEADER ===== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <ShieldCheck size={24} className="text-red-600" />
              إدارة الموظفين والصلاحيات
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {users.length} مستخدم مسجّل
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
          >
            <Plus size={16} /> إضافة موظف
          </button>
        </div>

        {/* شريط الحالة */}
        {saveStatus === "saved" && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
            <CheckCircle size={16} />
            <span className="text-sm font-semibold">تم الحفظ بنجاح ✓</span>
          </div>
        )}
        {saveStatus === "error" && (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <AlertCircle size={16} />
            <span className="text-sm font-semibold">فشل الحفظ - حاول مرة أخرى</span>
          </div>
        )}
      </div>

      {/* ===== USER LIST ===== */}
      {users.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <Users size={48} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 font-semibold text-lg">لا يوجد موظفون مسجّلون</p>
          <p className="text-gray-300 text-sm mt-1">
            اضغط "إضافة موظف" للبدء
          </p>
          <button
            onClick={openAdd}
            className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 text-sm"
          >
            إضافة أول موظف
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {users.map((user) => (
            <div
              key={user.id}
              className={`bg-white rounded-2xl shadow-sm border p-5 transition-all ${
                user.isActive === false
                  ? "border-gray-100 opacity-60"
                  : "border-gray-100 hover:shadow-md"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Avatar + Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl flex-shrink-0 ${
                      user.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {user.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-base">
                        {user.name}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          user.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {user.role === "admin" ? "🔑 مدير" : "👤 موظف"}
                      </span>
                      {user.isActive === false && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-semibold">
                          معطّل
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="font-mono">@{user.username}</span>
                      {user.createdAt && (
                        <span className="text-xs text-gray-300">
                          · أُضيف: {user.createdAt}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(user)}
                    className="p-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    title="تعديل"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="p-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                    title="حذف"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Permissions */}
              {user.role !== "admin" &&
                user.permissions &&
                user.permissions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 font-semibold mb-2">
                      الصلاحيات:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {user.permissions.map((key) => {
                        const p = ALL_PERMISSIONS.find((ap) => ap.key === key);
                        return p ? (
                          <span
                            key={key}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg"
                          >
                            {p.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

              {user.role === "admin" && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-purple-600 bg-purple-50 px-3 py-1 rounded-lg font-semibold">
                    ✓ صلاحيات كاملة على جميع أجزاء النظام
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ===== FORM MODAL ===== */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh] overflow-hidden">

            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2">
                {editingUser ? <Edit3 size={18} /> : <Plus size={18} />}
                {editingUser ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}
              </h3>
              <button
                onClick={closeForm}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* خطأ */}
              {formError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span className="text-sm font-semibold">{formError}</span>
                </div>
              )}

              {/* الاسم */}
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1.5">
                  الاسم الكامل <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  placeholder="مثال: أحمد محمد علي"
                  autoFocus
                />
              </div>

              {/* اسم المستخدم */}
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1.5">
                  اسم المستخدم <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.username ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      username: e.target.value.replace(/\s+/g, ""),
                    }))
                  }
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors font-mono"
                  placeholder="مثال: ahmed2024"
                />
                <p className="text-xs text-gray-400 mt-1">
                  بدون مسافات · يُستخدم لتسجيل الدخول
                </p>
              </div>

              {/* كلمة المرور */}
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1.5">
                  كلمة المرور <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, password: e.target.value }))
                    }
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors pl-12"
                    placeholder="4 أحرف على الأقل"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* الدور */}
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">
                  الدور الوظيفي <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((p) => ({ ...p, role: "employee" }))
                    }
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      formData.role === "employee"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <User size={16} /> موظف
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((p) => ({ ...p, role: "admin" }))
                    }
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      formData.role === "admin"
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <ShieldCheck size={16} /> مدير
                  </button>
                </div>
              </div>

              {/* الحالة */}
              <label className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-200">
                <input
                  type="checkbox"
                  checked={formData.isActive !== false}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, isActive: e.target.checked }))
                  }
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-700 block">
                    الحساب نشط
                  </span>
                  <span className="text-xs text-gray-400">
                    إلغاء التحديد يمنع تسجيل الدخول
                  </span>
                </div>
              </label>

              {/* الصلاحيات - للموظف فقط */}
              {formData.role === "employee" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-gray-700">
                      الصلاحيات
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            permissions: ALL_PERMISSIONS.map((ap) => ap.key),
                          }))
                        }
                        className="text-xs text-blue-600 hover:underline font-semibold"
                      >
                        تحديد الكل
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({ ...p, permissions: [] }))
                        }
                        className="text-xs text-red-500 hover:underline font-semibold"
                      >
                        إلغاء الكل
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                    {Object.entries(permissionGroups).map(([group, perms]) => (
                      <div key={group}>
                        <p className="text-xs font-bold text-gray-400 mb-1.5 px-1">
                          {group}
                        </p>
                        <div className="space-y-1">
                          {perms.map((perm) => (
                            <label
                              key={perm.key}
                              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={(formData.permissions ?? []).includes(
                                  perm.key
                                )}
                                onChange={() => togglePermission(perm.key)}
                                className="w-4 h-4 rounded accent-blue-600"
                              />
                              <span className="text-sm text-gray-700">
                                {perm.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* رسالة المدير */}
              {formData.role === "admin" && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <p className="text-sm text-purple-700 font-semibold flex items-center gap-2">
                    <ShieldCheck size={16} />
                    المدير لديه صلاحيات كاملة على جميع أجزاء النظام
                  </p>
                  <p className="text-xs text-purple-500 mt-1">
                    لا يحتاج تحديد صلاحيات منفردة
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-5 border-t border-gray-200 flex-shrink-0 bg-gray-50">
              <button
                onClick={handleSave}
                disabled={saveStatus === "saving"}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {saveStatus === "saving" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جارٍ الحفظ...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {editingUser ? "تحديث البيانات" : "إضافة الموظف"}
                  </>
                )}
              </button>
              <button
                onClick={closeForm}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 active:scale-95 transition-all flex items-center gap-2"
              >
                <X size={16} /> إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}