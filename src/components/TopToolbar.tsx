import React from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  FileEdit,
  Mic,
  Video,
  User,
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface TopToolbarProps {
  currentStep: string;
  onStepClick: (step: string) => void;
  isProcessing: boolean;
  hasVideo: boolean;
}

const workflowSteps = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'transcribe', label: 'Transcribe', icon: FileText },
  { id: 'analyze', label: 'Analyze Scene', icon: Sparkles },
  { id: 'script', label: 'Generate Script', icon: FileEdit },
  { id: 'voice', label: 'Synthesize Voice', icon: Mic },
  { id: 'render', label: 'Render Recap', icon: Video },
];

export function TopToolbar({
  currentStep,
  onStepClick,
  isProcessing,
  hasVideo
}: TopToolbarProps) {

  const currentIndex = workflowSteps.findIndex(s => s.id === currentStep);

  return (
    <div className="h-16 bg-white border-b border-[#DADCE0] flex items-center px-6 shadow-sm z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 mr-10 shrink-0">
        <div className="w-9 h-9 bg-[#202124] rounded-xl flex items-center justify-center">
          <Video className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-[#202124]">AI Cut Assistant</span>
        </div>
      </div>

      {/* Workflow Pipeline */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-1 bg-[#F1F3F4] p-1 rounded-xl border border-[#DADCE0] relative">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = index < currentIndex;
            const isDisabled = !hasVideo && step.id !== 'upload';

            return (
              <React.Fragment key={step.id}>
                {/* Кнопка шага */}
                <button
                  disabled={isDisabled || (isProcessing && isActive)}
                  onClick={() => onStepClick(step.id)}
                  className={`
                    relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300
                    ${isActive 
                      ? 'bg-white text-[#1A73E8] shadow-sm ring-1 ring-black/5' 
                      : isCompleted
                      ? 'bg-[#202124] text-white hover:bg-[#5F6368]'
                      : 'bg-transparent text-[#5F6368] hover:bg-white/40'
                    }
                    ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="relative">
                    {isActive && isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-xs font-bold whitespace-nowrap">{step.label}</span>
                </button>

                {/* Разделительная линия между шагами */}
                {index < workflowSteps.length - 1 && (
                  <div className="flex items-center px-1">
                    <div className={`w-4 h-px ${index < currentIndex ? 'bg-[#1A73E8]' : 'bg-[#DADCE0]'}`} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* User Avatar */}
      <div className="ml-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#5F6368] flex items-center justify-center cursor-pointer hover:bg-[#202124] transition-colors shadow-sm">
          <User className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}