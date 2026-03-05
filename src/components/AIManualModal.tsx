import React, { useState } from 'react';
import { Copy, ExternalLink, Check, Wand2 } from 'lucide-react';

interface AIManualModalProps {
  transcript: any[];
  markers: any[];
  onResult: (json: any) => void;
  onClose: () => void;
}

export function AIManualModal({ transcript, markers, onResult, onClose }: AIManualModalProps) {
  const [pastedText, setPastedText] = useState('');
  const [copied, setCopied] = useState(false);

  // Формируем промпт, который вы вставите в чат-бота
  const prompt = `Ты — профессиональный видеорежиссер. На основе данных ниже создай сценарий рекапа.
  
  ТРАНСКРИПТ:
  ${transcript.map(t => `[${t.timecode}s] ${t.text}`).join('\n')}
  
  ВИЗУАЛЬНЫЕ СЦЕНЫ:
  ${markers.map(m => `[${m.timecode}s] ${m.description}`).join('\n')}
 ПРИ НАПИСАНИИ СКРИПТА ПРИДЕРЖИВАТЬСЯ правил:
  1. более провакационный текст скрипта;
  2. Не нужно озвучивать каждый шаг, т.е. НЕ ДЕЛАЙ ОЧЕНЬ ПОДРОБНО, ВЫРЕЗАЙ ТЕ СЦЕНЫ, КОТОРЫЕ НЕ НУЖНЫ ДЛЯ ПЕРЕСКАЗА, 
  3. НУЖНО СЖАТЬ МАТЕРИВАЛ как для вертикального контента в 1-1.5 минуты
  4. текст пересказа должен идеально соответствовать таймлайну визуала!
  5. Транскрипт и визуальные описания сцен нужно сопоставлять для понимания!
  6. Нужно нарезать рассказ на сцены и частями его передавать
  7. Делай маленькие нарезки видеоматериала и подставляй под них текст
  8. нельзя цитировать транскрипт, только собственный пересказ
  9. ты по сути пересказываешь содержание, сосредоточься на этом
  ЗАДАЧА: Выбери лучшие моменты для передачи минимального содержания, придерживайся максимальному пересказу. Укажи границы (start_time, end_time) и напиши narrator_text.
  ВЕРНИ СТРОГО JSON В ФОРМАТЕ:
  {"segments": [{"id": "1", "start_time": 0.0, "end_time": 5.0, "narrator_text": "текст"}]}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    // Открываем DeepSeek или Gemini в новой вкладке
    window.open('https://chat.deepseek.com/', '_blank');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleProcess = () => {
    try {
      // Очищаем вставленный текст от мыслей <think> и markdown
      const cleanJson = pastedText.replace(/<think>[\s\S]*?<\/think>/g, '')
                                  .replace(/```json|```/g, '')
                                  .trim();
      const data = JSON.parse(cleanJson);
      onResult(data);
      onClose();
    } catch (e) {
      alert("Ошибка: Вставьте корректный JSON ответ от ИИ");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-[#DADCE0]">
        <div className="p-6 border-b border-[#DADCE0] bg-[#F8F9FA] flex justify-between items-center">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-[#1A73E8]" />
            AI Script Assistant (Manual Mode)
          </h3>
          <button onClick={onClose} className="text-[#5F6368] hover:text-black">✕</button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-[#202124]">Шаг 1: Скопируйте данные и отправьте в чат-бота</p>
            <button
              onClick={handleCopy}
              className="w-full py-4 bg-[#E8F0FE] border-2 border-dashed border-[#1A73E8] rounded-xl flex items-center justify-center gap-3 text-[#1A73E8] font-bold hover:bg-[#D2E3FC] transition-all"
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Скопировано! Переходим в чат..." : "Скопировать промпт для ИИ"}
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-[#202124]">Шаг 2: Вставьте ответ ИИ (JSON) сюда</p>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Вставьте сюда ответ от DeepSeek / ChatGPT..."
              className="w-full h-40 p-3 text-xs font-mono bg-[#F8F9FA] border border-[#DADCE0] rounded-xl focus:ring-2 focus:ring-[#1A73E8] outline-none resize-none"
            />
          </div>

          <button
            onClick={handleProcess}
            disabled={!pastedText}
            className="w-full py-3 bg-[#1A73E8] text-white rounded-xl font-bold hover:bg-[#1557B0] disabled:opacity-50 transition-all shadow-lg"
          >
            Применить сценарий к таймлайну
          </button>
        </div>
      </div>
    </div>
  );
}