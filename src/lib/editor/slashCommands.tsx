import { Editor, Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import tippy, { Instance, Props } from 'tippy.js';

import SlashCommandList, { CommandItem, SlashCommandListProps } from '@/components/editor/SlashCommandList.tsx';
import { Icons } from '@/components/ui/Icons';

const getCommandItems = ({ query }: { query: string }): CommandItem[] => {
  const items: CommandItem[] = [
    { title: 'Heading 1', subtitle: 'Large section heading', icon: <Icons.Heading1 />, command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(); } },
    { title: 'Heading 2', subtitle: 'Medium section heading', icon: <Icons.Heading2 />, command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(); } },
    { title: 'Heading 3', subtitle: 'Small section heading', icon: <Icons.Type />, command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(); } },
    { title: 'Bulleted List', subtitle: 'Create a simple bulleted list', icon: <Icons.List />, command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).toggleBulletList().run(); } },
    { title: 'Numbered List', subtitle: 'Create a list with numbering', icon: <Icons.ListOrdered />, command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).toggleOrderedList().run(); } },
    { title: 'Blockquote', subtitle: 'Capture a quote', icon: <Icons.Quote />, command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).toggleBlockquote().run(); } },
    { title: 'Code Block', subtitle: 'Capture a code snippet', icon: <Icons.FileText />, command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).toggleCodeBlock().run(); } },
    // Add more commands like Task List, Table, Image when extensions are added
  ];

  if (!query) {
    return items;
  }

  return items.filter(item => item.title.toLowerCase().startsWith(query.toLowerCase()));
};

// Type for the render function's return object
interface SuggestionRender<I> {
  onStart?: (props: SuggestionProps<I>) => void;
  onUpdate?: (props: SuggestionProps<I>) => void;
  onExit?: () => void;
  onKeyDown?: (props: SuggestionKeyDownProps) => boolean; // Return strictly boolean
}

// Explicitly type the configuration object
export const slashCommandSuggestion: Omit<SuggestionOptions<CommandItem>, 'editor'> = {
  items: getCommandItems,
  allowSpaces: false,
  char: '/',
  command: ({ editor, range, props }: { editor: Editor, range: Range, props: CommandItem }) => {
    props.command({ editor, range });
  },
  render: (): SuggestionRender<CommandItem> => {
    let component: ReactRenderer<SlashCommandListProps>;
    let popup: Instance<Props>[];

    return {
      onStart: (props: SuggestionProps<CommandItem>) => {
        component = new ReactRenderer(SlashCommandList, {
          props: { ...props, command: props.command },
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      onUpdate(props: SuggestionProps<CommandItem>) {
        component.updateProps({ ...props, command: props.command });

        if (!props.clientRect) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      },

      onKeyDown(props: SuggestionKeyDownProps): boolean { // Ensure return is boolean
        if (props.event.key === 'Escape') {
          popup[0].hide();
          return true;
        }
        if (component.ref?.onKeyDown) {
          // Ensure the forwarded handler returns boolean, or provide default
          const result = component.ref.onKeyDown(props);
          return typeof result === 'boolean' ? result : false; 
        }
        return false;
      },

      onExit() {
        if (popup && popup[0]) {
            popup[0].destroy();
        }
        if (component) {
            component.destroy();
        }
      },
    };
  },
}; 