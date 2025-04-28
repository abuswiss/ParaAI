import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Icons } from '@/components/ui/Icons'; // Assuming icons for commands

interface SlashCommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void; // Function to execute selected command
}

export interface CommandItem {
  title: string;
  subtitle?: string;
  icon: React.ReactNode; // Expecting an icon component or element
  command: ({ editor, range }: { editor: any; range: any }) => void; // Editor command function
}

const SlashCommandList = forwardRef((props: SlashCommandListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = useCallback((index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item); // Execute the command associated with the item
    }
  }, [props]);

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: React.KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return null;
  }

  return (
    <div className="z-50 max-h-80 overflow-y-auto rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 py-1">
      {props.items.map((item: CommandItem, index: number) => (
        <button
          className={`flex items-center w-full px-3 py-1.5 text-left text-sm transition-colors ${index === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
          key={index}
          onClick={() => selectItem(index)}
        >
          <div className="mr-2 text-gray-500 dark:text-gray-400">{item.icon}</div>
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-100">{item.title}</p>
            {item.subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{item.subtitle}</p>}
          </div>
        </button>
      ))}
    </div>
  );
});

SlashCommandList.displayName = 'SlashCommandList'; // Add display name for React DevTools

export default SlashCommandList; 