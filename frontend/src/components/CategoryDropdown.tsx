import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { getCategoryColor, getCategoryDisplayName, ALL_CATEGORIES } from "../utils/categoryColors";

interface CategoryDropdownProps {
  value: string;
  onChange: (category: string) => void;
  disabled?: boolean;
}

export default function CategoryDropdown({ value, onChange, disabled = false }: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const categories = [
    { value: "all", label: "All Categories", color: "#999" },
    ...ALL_CATEGORIES.map((cat) => ({
      value: cat,
      label: getCategoryDisplayName(cat),
      color: getCategoryColor(cat),
    })),
  ];

  const selectedCategory = categories.find((cat) => cat.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`min-w-[200px] px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-between gap-3 ${
          disabled 
            ? 'opacity-50 cursor-not-allowed text-gray-400' 
            : 'text-gray-700 hover:border-orange-400 hover:bg-gray-50 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: selectedCategory?.color }}
          />
          <span>{selectedCategory?.label}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
            isOpen ? "transform rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-xl max-h-[400px] overflow-y-auto z-50 animate-fadeIn">
          {categories.map((category) => (
            <button
              key={category.value}
              onClick={() => {
                onChange(category.value);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 flex items-center gap-3 border-l-4 relative group"
              style={{
                borderLeftColor: category.color,
              }}
            >
              {/* Color dot */}
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: category.color }}
              />

              {/* Category label */}
              <span className="flex-1 text-sm font-medium text-gray-700">
                {category.label}
              </span>

              {/* Check mark for selected item */}
              {value === category.value && (
                <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}