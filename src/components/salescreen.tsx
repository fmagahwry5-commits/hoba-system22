import { useShift } from "../useShift";

export default function SaleScreen() {
  const { hasActiveShift } = useShift();

  if (!hasActiveShift) {
    return (
      <div className="p-6 border rounded-xl bg-red-50 text-red-700">
        لازم تفتح وردية الأول عشان تقدر تبيع
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">شاشة البيع</h1>
      {/* هنا تحط الفورم أو POS */}
    </div>
  );
}