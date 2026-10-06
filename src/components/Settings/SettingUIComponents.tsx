import React from 'react';
import { HelpCircle } from 'lucide-react';

export interface SettingSectionCardProps {
  id?: string;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  badge?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}

export const SettingSectionCard: React.FC<SettingSectionCardProps> = ({
  id,
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  headerAction,
}) => {
  return (
    <div
      id={id}
      className="bg-stone-900 border border-stone-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-5 transition-all hover:border-stone-750"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800/80">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
            <Icon className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-stone-100 text-base sm:text-lg tracking-tight">
                {title}
              </h3>
              {badge && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
};

export interface SettingRowProps {
  label: string;
  description?: string;
  tooltip?: string;
  children: React.ReactNode;
  vertical?: boolean;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  tooltip,
  children,
  vertical = false,
}) => {
  return (
    <div
      className={`py-2.5 flex ${
        vertical
          ? 'flex-col gap-2'
          : 'flex-col sm:flex-row sm:items-center justify-between gap-3'
      } border-b border-stone-850/60 last:border-b-0`}
    >
      <div className="min-w-0 pr-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs sm:text-sm font-bold text-stone-200">
            {label}
          </span>
          {tooltip && (
            <span
              className="inline-flex items-center text-stone-500 hover:text-stone-300 transition cursor-help"
              title={tooltip}
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
        {description && (
          <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className={`shrink-0 ${vertical ? 'w-full' : 'sm:w-auto'}`}>
        {children}
      </div>
    </div>
  );
};

export interface SettingToggleProps {
  id?: string;
  label: string;
  description?: string;
  tooltip?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const SettingToggle: React.FC<SettingToggleProps> = ({
  id,
  label,
  description,
  tooltip,
  checked,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-stone-850/60 last:border-b-0">
      <div className="min-w-0 pr-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs sm:text-sm font-bold text-stone-200">
            {label}
          </span>
          {tooltip && (
            <span
              className="inline-flex items-center text-stone-500 hover:text-stone-300 transition cursor-help"
              title={tooltip}
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
        {description && (
          <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-red-600' : 'bg-stone-800'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};

export interface SettingInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  prefixLabel?: string;
  suffixLabel?: string;
}

export const SettingInput: React.FC<SettingInputProps> = ({
  prefixLabel,
  suffixLabel,
  className = '',
  ...props
}) => {
  return (
    <div className="relative flex items-center">
      {prefixLabel && (
        <span className="absolute left-3 text-xs font-bold text-stone-400 pointer-events-none select-none">
          {prefixLabel}
        </span>
      )}
      <input
        {...props}
        className={`w-full min-h-[44px] bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:outline-none transition shadow-inner ${
          prefixLabel ? 'pl-9' : 'pl-3.5'
        } ${suffixLabel ? 'pr-9' : 'pr-3.5'} ${className}`}
      />
      {suffixLabel && (
        <span className="absolute right-3 text-xs font-bold text-stone-400 pointer-events-none select-none">
          {suffixLabel}
        </span>
      )}
    </div>
  );
};

export interface SettingSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string | number; label: string }>;
}

export const SettingSelect: React.FC<SettingSelectProps> = ({
  options,
  className = '',
  ...props
}) => {
  return (
    <select
      {...props}
      className={`min-h-[44px] bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl px-3.5 text-xs sm:text-sm text-stone-100 focus:outline-none transition shadow-inner cursor-pointer ${className}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-stone-900 text-stone-100">
          {opt.label}
        </option>
      ))}
    </select>
  );
};
