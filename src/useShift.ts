// src/useShift.ts
import { useState, useCallback, useEffect, useRef } from "react";
import {
  loadState,
  getActiveShift,
  setActiveShift,
  clearActiveShift,
  getDefaultShiftResetSettings,
  calcShiftSummary,
} from "./store";
import { AppState, ShiftResetSettings, ShiftArchive } from "./types";

export function useShift() {
  // ✅ تهيئة مرة واحدة فقط
  const [activeShift, setActiveShiftState] = useState<{
    id: string;
    openedAt?: string;
  } | null>(() => getActiveShift());

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ✅ فحص دوري كل 10 ثوانٍ فقط (وليس كل ثانية)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const current = getActiveShift();
      setActiveShiftState((prev) => {
        if (prev?.id !== current?.id) return current;
        return prev; // ✅ لا تعيد الكائن إذا لم يتغير
      });
    }, 10000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // ✅ dependencies فارغة تماماً

  // ✅ مستمع storage للتحديث الفوري من تاب آخر
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== "activeShift") return;
      const current = getActiveShift();
      setActiveShiftState((prev) => {
        if (prev?.id !== current?.id) return current;
        return prev;
      });
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []); // ✅ dependencies فارغة

  const hasActiveShift = !!activeShift;

  // ✅ closeShift المُصلَح بالكامل
  const closeShift = useCallback(
    (autoRestart: boolean, resetSettings?: ShiftResetSettings): AppState => {
      const shift = getActiveShift();
      const currentState = loadState();

      if (!shift) return currentState;

      const settings =
        resetSettings ??
        currentState.settings?.shiftResetSettings ??
        getDefaultShiftResetSettings();

      const now = new Date();
      const nowStr = now.toLocaleString("ar-EG");

      // حساب الملخص
      const summary = calcShiftSummary(
        currentState.invoices,
        currentState.installmentsLedger?.payments ?? [],
        currentState.treasury?.balance ?? 0
      );

      // بناء الأرشيف
      const archive: ShiftArchive = {
        id: shift.id,
        openedAt: shift.openedAt ?? "",
        closedAt: nowStr,
        summary,
        invoices: [...(currentState.invoices ?? [])],
        installments: [...(currentState.installmentsLedger?.payments ?? [])],
        treasuryEntries: [...(currentState.treasury?.entries ?? [])],
        resetSettings: settings,
      };

      // تحديد الفواتير التي تبقى
      const remainingInvoices = (currentState.invoices ?? []).filter((inv) => {
        if (!inv) return false;
        // الفواتير المعلقة والمفتوحة تبقى دائماً
        if (inv.status === "pending" || inv.status === "open") return true;
        if (inv.status !== "closed") return true;
        // الفواتير المغلقة: حسب إعدادات التصفير
        switch (inv.type) {
          case "sale":             return !settings.resetSales;
          case "purchase":         return !settings.resetPurchases;
          case "return_sale":      return !settings.resetReturnSales;
          case "return_purchase":  return !settings.resetReturnPurchases;
          case "maintenance":      return !settings.resetMaintenance;
          case "accessory_sale":   return !settings.resetAccessorySales;
          case "accessory_purchase": return !settings.resetAccessoryPurchases;
          default: return true;
        }
      });

      // تصفير الأقساط إذا لزم
      const newInstallments = settings.resetInstallments
        ? { totalReceived: 0, payments: [] }
        : (currentState.installmentsLedger ?? { totalReceived: 0, payments: [] });

      // إزالة الوردية القديمة
      clearActiveShift();

      // بناء الحالة الجديدة
      let newState: AppState = {
        ...currentState,
        invoices: remainingInvoices,
        installmentsLedger: newInstallments,
        shiftArchives: [archive, ...(currentState.shiftArchives ?? [])],
      };

      // فتح وردية جديدة إذا لزم
      if (autoRestart) {
        const newShiftId = `shift-${Date.now()}`;
        const newShiftData = { id: newShiftId, openedAt: nowStr };
        setActiveShift(newShiftData);
        setActiveShiftState(newShiftData);
        newState = { ...newState, activeShift: newShiftData };
      } else {
        setActiveShiftState(null);
      }

      // ✅ حفظ فوري ومباشر
      try {
        localStorage.setItem("appState", JSON.stringify(newState));
      } catch (err) {
        console.error("closeShift save error:", err);
      }

      return newState;
    },
    [] // ✅ لا dependencies خارجية
  );

  return { hasActiveShift, activeShift, closeShift };
}