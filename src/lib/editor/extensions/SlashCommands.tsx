import { Extension } from '@tiptap/core';
import { Editor, ReactRenderer } from '@tiptap/react';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import tippy, { Instance, Props } from 'tippy.js';
import { Wand2, PilcrowSquare, AlignLeft, ListChecks, BrainCircuit } from 'lucide-react';
import React from 'react';

type CommandItemProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

type CommandProps = {
  editor: Editor;
  range: any;
  props: {
    command: (props: { editor: Editor; range: any }) => void;
    items: CommandItemProps[];
    clientRect: () => DOMRect;
  };
};

const CommandList = React.forwardRef((props: CommandProps, ref) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const selectItem = (index: number) => {
    const item = props.props.items[index];
    if (item) {
      props.props.command({ editor: props.editor, range: props.range });
    }
  };

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.props.items.length - 1) % props.props.items.length);
        return true;
      }

      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.props.items.length);
        return true;
      }

      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }

      return false;
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [selectedIndex, props.props.items]);

  return (
    <div 
      className="bg-background border rounded shadow-lg overflow-hidden z-50"
      style={{ width: '320px' }}
      ref={ref as React.RefObject<HTMLDivElement>}
    >
      <div className="p-1">
        {props.props.items.length ? (
          props.props.items.map((item, index) => (
            <button
              key={index}
              className={`flex items-center gap-2 p-2 w-full text-left rounded ${
                index === selectedIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
              onClick={() => selectItem(index)}
            >
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-primary/10">
                {item.icon}
              </div>
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.description}</div>
              </div>
            </button>
          ))
        ) : (
          <div className="p-3 text-sm text-muted-foreground">No results</div>
        )}
      </div>
    </div>
  );
});

CommandList.displayName = 'CommandList';

interface SlashCommandsOptions {
  onSummarize?: (editor: Editor) => void;
  onRewrite?: (editor: Editor, mode?: string) => void;
  suggestClassName?: string;
}

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: 'slashCommands',

  addOptions() {
    return {
      onSummarize: undefined,
      onRewrite: undefined,
      suggestClassName: 'suggestion',
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        items: ({ query }) => {
          const { onSummarize, onRewrite } = this.options;
          
          const baseItems = [
            {
              title: 'Summarize',
              description: 'AI-powered summary of selected text',
              icon: <BrainCircuit className="h-4 w-4" />,
              command: ({ editor, range }) => {
                editor.commands.deleteRange(range);
                if (onSummarize) onSummarize(editor);
              },
            },
            {
              title: 'Improve writing',
              description: 'Enhance the clarity and quality of text',
              icon: <Wand2 className="h-4 w-4" />,
              command: ({ editor, range }) => {
                editor.commands.deleteRange(range);
                if (onRewrite) onRewrite(editor, 'improve');
              },
            },
            {
              title: 'Make shorter',
              description: 'Create a more concise version of the text',
              icon: <AlignLeft className="h-4 w-4" />,
              command: ({ editor, range }) => {
                editor.commands.deleteRange(range);
                if (onRewrite) onRewrite(editor, 'shorten');
              },
            },
            {
              title: 'Expand text',
              description: 'Add more detail to the selected text',
              icon: <ListChecks className="h-4 w-4" />,
              command: ({ editor, range }) => {
                editor.commands.deleteRange(range);
                if (onRewrite) onRewrite(editor, 'expand');
              },
            },
            {
              title: 'Professional tone',
              description: 'Rewrite in a formal business style',
              icon: <PilcrowSquare className="h-4 w-4" />,
              command: ({ editor, range }) => {
                editor.commands.deleteRange(range);
                if (onRewrite) onRewrite(editor, 'professional');
              },
            },
          ];

          if (!query) return baseItems;

          return baseItems.filter(item => 
            item.title.toLowerCase().includes(query.toLowerCase()));
        },
        render: () => {
          let component: ReactRenderer;
          let popup: Instance<Props>[] = [];

          return {
            onStart: props => {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              });

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },
            onUpdate(props) {
              component.updateProps(props);

              popup[0].setProps({
                getReferenceClientRect: props.clientRect,
              });
            },
            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                popup[0].hide();
                return true;
              }

              return component.ref?.onKeyDown(props);
            },
            onExit() {
              popup[0].destroy();
              component.destroy();
            },
          };
        },
      }) as any,
    ];
  },
}); 