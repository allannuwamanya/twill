import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot, Terminal } from 'lucide-react';

interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ role, content, isStreaming }) => {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  const avatar = isUser ? (
    <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground">
      <User className="w-4 h-4" />
    </div>
  ) : isSystem ? (
    <div className="w-8 h-8 rounded-lg bg-muted/60 border border-border flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground">
      <Terminal className="w-4 h-4" />
    </div>
  ) : (
    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 text-primary">
      <Bot className="w-4 h-4" />
    </div>
  );

  return (
    <div className={`flex gap-3 my-3 max-w-4xl mx-auto ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && avatar}

      <div
        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground max-w-[80%]'
            : isSystem
            ? 'bg-muted/50 border border-border/70 text-muted-foreground max-w-[90%]'
            : 'bg-card border border-border/70 text-card-foreground shadow-sm flex-1'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap select-text">{content}</p>
        ) : (
          <div className="prose dark:prose-invert max-w-none text-sm select-text">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // react-markdown v9 removed the `inline` prop. A fenced code
                // block carries a language className; inline code does not.
                code({ className, children, ...props }: any) {
                  const isBlock = /language-(\w+)/.test(className || '');
                  return isBlock ? (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-foreground" {...props}>
                      {children}
                    </code>
                  );
                },
                // react-markdown wraps every code block in <pre>; styling it here
                // keeps the block chrome in one place instead of inside `code`.
                pre({ children }) {
                  return (
                    <pre className="p-3 my-2 rounded-xl bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto border border-zinc-800">
                      {children}
                    </pre>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 align-middle bg-primary animate-pulse" />
            )}
          </div>
        )}
      </div>

      {isUser && avatar}
    </div>
  );
};