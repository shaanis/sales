import React from "react";
export function Field({ label, children, hint, className = "" }) {
    return (
      <label className={`field ${className}`}>
        <span>{label}</span>
        {children}
        {hint && <small className="hint">{hint}</small>}
      </label>
    );
  }
  
  export function Input({
    value,
    onChange,
    placeholder = "Enter details...",
    ...props
  }) {
    return (
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        {...props}
      />
    );
  }
  
  export function Area({ value, onChange, placeholder = "Add details..." }) {
    return (
      <textarea
        rows="2"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    );
  }