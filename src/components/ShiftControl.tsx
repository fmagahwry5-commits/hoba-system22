import { openShift, closeShift } from "../shift/store";
import { useShift } from "../shift/useShift";

export default function ShiftControls() {
  const { hasActiveShift } = useShift();

  return (
    <div className="flex gap-2">
      {!hasActiveShift ? (
        <button
          onClick={openShift}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          فتح وردية
        </button>
      ) : (
        <button
          onClick={closeShift}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          قفل وردية
        </button>
      )}
    </div>
  );
}