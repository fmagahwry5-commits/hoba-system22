import React from 'react';
import { Download, Upload, ShieldCheck } from 'lucide-react';
import { AppState } from '../types';
import { saveState } from '../store';

export default function BackupRestore({ state, onUpdate }: { state: AppState, onUpdate: (s: AppState) => void }) {
  const handleExport = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const fileName = `POS_Backup_${new Date().toLocaleDateString('ar-EG')}.json`;
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', fileName);
    link.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const reader = new FileReader();
    if (!event.target.files?.[0]) return;
    
    reader.readAsText(event.target.files[0], "UTF-8");
    reader.onload = e => {
      try {
        const newState = JSON.parse(e.target?.result as string);
        if (window.confirm("تحذير: استيراد بيانات جديدة سيقوم بحذف البيانات الحالية. هل تريد الاستمرار؟")) {
          saveState(newState);
          onUpdate(newState);
          window.location.reload();
        }
      } catch (err) {
        alert("الملف غير صالح أو تالف");
      }
    };
  };

  return (
    <div className="bg-white border-2 border-dashed border-blue-200 rounded-3xl p-8 text-center space-y-4">
      <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-blue-600">
        <ShieldCheck size={32} />
      </div>
      <div>
        <h3 className="text-xl font-black text-gray-800">حماية البيانات والنسخ الاحتياطي</h3>
        <p className="text-gray-500 text-sm mt-1">قم بتحميل نسخة من بياناتك بانتظام لتجنب فقدانها</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <button onClick={handleExport} className="flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 px-8 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
          <Download size={20} /> حفظ نسخة احتياطية (JSON)
        </button>
        <div className="relative">
          <input type="file" accept=".json" onChange={handleImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <button className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-bold py-3 px-8 rounded-2xl hover:bg-gray-200 transition-all">
            <Upload size={20} /> استعادة من ملف
          </button>
        </div>
      </div>
    </div>
  );
}