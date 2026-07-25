// src/useSupabaseSync.ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import { AppState } from "./types";

type SyncStatus = "idle" | "syncing" | "saved" | "error" | "offline";

const STATE_ROW_ID = "main";

function getDeviceId(): string {
  let id = localStorage.getItem("app_device_id");
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("app_device_id", id);
  }
  return id;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "📱 iPhone";
  if (/iPad/i.test(ua)) return "📱 iPad";
  if (/Android/i.test(ua)) {
    const m = ua.match(/Android.*?;\s*(.*?)\s*Build/);
    return `📱 ${m ? m[1] : "Android"}`;
  }
  return "🖥️ Desktop";
}

export function useSupabaseSync(
  state: AppState,
  onStateUpdate: (s: AppState) => void,
  currentUser: any
) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<any[]>([]);

  const deviceId = useRef(getDeviceId());
  const deviceName = useRef(getDeviceName());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJson = useRef("");
  const isReceiving = useRef(false);
  const stateRef = useRef(state);
  const userRef = useRef(currentUser);
  const stateChannelRef = useRef<RealtimeChannel | null>(null);
  const devicesChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { userRef.current = currentUser; }, [currentUser]);

  // ── حفظ في Supabase ──
  const syncToSupabase = useCallback(async (data: AppState): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;
    try {
      setSyncStatus("syncing");
      const payload = {
        ...data,
        lastUpdatedBy: deviceId.current,
        lastUpdatedAt: new Date().toISOString(),
      };
      const { error } = await supabase.from("app_state").upsert(
        {
          id: STATE_ROW_ID,
          data: payload,
          updated_by: deviceId.current,
          updated_at: new Date().toISOString(),
          version: Date.now(),
        },
        { onConflict: "id" }
      );
      if (error) throw error;
      setSyncStatus("saved");
      setLastSyncTime(new Date());
      setTimeout(() => setSyncStatus("idle"), 2000);
      return true;
    } catch (err) {
      console.error("Supabase sync error:", err);
      setSyncStatus("error");
      return false;
    }
  }, []);

  // ── اتصال الإنترنت ──
  useEffect(() => {
    const onOnline = async () => {
      setIsOnline(true);
      if (pendingSync) {
        const ok = await syncToSupabase(stateRef.current);
        if (ok) setPendingSync(false);
      }
    };
    const onOffline = () => {
      setIsOnline(false);
      setSyncStatus("offline");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [pendingSync, syncToSupabase]);

  // ── تسجيل الجهاز ──
  const registerDevice = useCallback(async () => {
    if (!isSupabaseConfigured || !userRef.current) return;
    try {
      await supabase.from("connected_devices").upsert(
        {
          device_id: deviceId.current,
          device_name: deviceName.current,
          user_name: userRef.current?.name || "مستخدم",
          is_online: true,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "device_id" }
      );
    } catch {
      /* ignore */
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from("connected_devices")
        .select("*")
        .eq("is_online", true);
      if (error) throw error;
      const devices = (data || []).map((d: any) => ({
        id: d.device_id,
        deviceId: d.device_id,
        deviceName: d.device_name,
        userName: d.user_name,
        isOnline: d.is_online,
        lastSeen: d.last_seen,
      }));
      setConnectedDevices(devices);
    } catch {
      /* ignore */
    }
  }, []);

  // ── تحميل أولي + Real-time Subscription ──
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSyncStatus("idle");
      return;
    }

    const init = async () => {
      setSyncStatus("syncing");
      await registerDevice();

      // تحميل البيانات أول مرة
      try {
        const { data: row, error } = await supabase
          .from("app_state")
          .select("data, updated_by")
          .eq("id", STATE_ROW_ID)
          .maybeSingle();
        if (error) throw error;
        if (row?.data && row.updated_by !== deviceId.current) {
          isReceiving.current = true;
          onStateUpdate(row.data);
          isReceiving.current = false;
          lastSavedJson.current = JSON.stringify(row.data);
          setLastSyncTime(new Date());
        }
      } catch (err) {
        console.error("Initial load error:", err);
      }

      setSyncStatus("idle");

      // Real-time listener على تغييرات الحالة
      stateChannelRef.current = supabase
        .channel("app_state_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "app_state", filter: `id=eq.${STATE_ROW_ID}` },
          (payload) => {
            const row: any = payload.new;
            if (!row?.data) return;
            if (row.updated_by === deviceId.current) return;

            isReceiving.current = true;
            onStateUpdate(row.data);
            isReceiving.current = false;
            lastSavedJson.current = JSON.stringify(row.data);
            setLastSyncTime(new Date());
          }
        )
        .subscribe();

      // Real-time listener على الأجهزة المتصلة
      await refreshDevices();
      devicesChannelRef.current = supabase
        .channel("connected_devices_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "connected_devices" },
          () => {
            refreshDevices();
          }
        )
        .subscribe();
    };

    init();

    return () => {
      if (stateChannelRef.current) supabase.removeChannel(stateChannelRef.current);
      if (devicesChannelRef.current) supabase.removeChannel(devicesChannelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Heartbeat ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const iv = setInterval(() => {
      if (isOnline) registerDevice();
    }, 60000);

    const onUnload = () => {
      // best-effort: تحديث حالة الجهاز إلى غير متصل عند إغلاق الصفحة
      supabase
        .from("connected_devices")
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq("device_id", deviceId.current)
        .then(() => {}, () => {});
    };

    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(iv);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [isOnline, registerDevice]);

  // ── حفظ تلقائي ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (isReceiving.current) return;

    const json = JSON.stringify(state);
    if (json === lastSavedJson.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      if (!isOnline) {
        setPendingSync(true);
        setSyncStatus("offline");
        return;
      }
      const ok = await syncToSupabase(state);
      if (ok) {
        lastSavedJson.current = json;
        setPendingSync(false);
      } else {
        setPendingSync(true);
      }
    }, 2500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, isOnline, syncToSupabase]);

  // ── مزامنة يدوية ──
  const manualSync = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setSyncStatus("syncing");
    try {
      const { data: row, error } = await supabase
        .from("app_state")
        .select("data")
        .eq("id", STATE_ROW_ID)
        .maybeSingle();
      if (error) throw error;
      if (row?.data) {
        isReceiving.current = true;
        onStateUpdate(row.data);
        isReceiving.current = false;
        lastSavedJson.current = JSON.stringify(row.data);
      }
      setSyncStatus("saved");
      setLastSyncTime(new Date());
      setTimeout(() => setSyncStatus("idle"), 2000);
    } catch {
      setSyncStatus("error");
    }
  }, [onStateUpdate]);

  return {
    syncStatus,
    lastSyncTime,
    isOnline,
    pendingSync,
    connectedDevices,
    manualSync,
    deviceId: deviceId.current,
  };
}
