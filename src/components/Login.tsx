// components/Login.tsx
import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, LogIn, ShieldCheck, AlertCircle } from "lucide-react";

interface AppUser {
  id: string;
  name: string;
  username: string;
  password: string;
  role: "admin" | "employee";
  isActive?: boolean;
}

interface Props {
  onLogin: (user: AppUser) => void;
  allUsers: AppUser[];
}

// ✅ المدير الافتراضي - يُستخدم فقط إذا لم يكن هناك أي مستخدمين
const DEFAULT_ADMIN: AppUser = {
  id: "default-admin",
  name: "مدير النظام",
  username: "admin",
  password: "1234",
  role: "admin",
  isActive: true,
};

export default function Login({ onLogin, allUsers }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ✅ استخدم المستخدمين المحفوظين، وأضف المدير الافتراضي فقط إذا القائمة فارغة
  const effectiveUsers = allUsers.length > 0 ? allUsers : [DEFAULT_ADMIN];

  const handleLogin = useCallback(() => {
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const user = effectiveUsers.find(
        (u) =>
          u.username.toLowerCase().trim() === username.toLowerCase().trim() &&
          u.password === password.trim()
      );

      if (!user) {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة");
        setIsLoading(false);
        return;
      }

      if (user.isActive === false) {
        setError("هذا الحساب معطل، تواصل مع المدير");
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      onLogin(user);
    }, 300);
  }, [username, password, effectiveUsers, onLogin]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">📱</span>
          </div>
          <h1 className="text-2xl font-black text-white">مدير المبيعات</h1>
          <p className="text-blue-200 text-sm mt-1">نظام إدارة المبيعات المتكامل</p>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1.5">
              اسم المستخدم
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
              placeholder="أدخل اسم المستخدم"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors pl-12"
                placeholder="أدخل كلمة المرور"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-base hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={18} /> تسجيل الدخول
              </>
            )}
          </button>

          {/* معلومات الدخول الافتراضي */}
          {allUsers.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
              <ShieldCheck size={16} className="mx-auto text-amber-600 mb-1" />
              <p className="text-xs text-amber-700 font-semibold">بيانات الدخول الافتراضية</p>
              <p className="text-xs text-amber-600 mt-1">
                المستخدم: <span className="font-mono font-bold">admin</span>
                {" "}| كلمة المرور: <span className="font-mono font-bold">1234</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}