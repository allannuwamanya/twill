import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ role, content, isStreaming }) => {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  if (isUser) {
    return (
      <div className="my-4 max-w-3xl ml-auto">
        {/* User bubble as an elevated warm card matching Claude Desktop */}
        <div className="rounded-2xl bg-[#282724] border border-[#383631] px-4 py-3 text-xs sm:text-sm leading-relaxed text-[#eeeae4] shadow-sm select-text">
          <p className="whitespace-pre-wrap font-normal">{content}</p>
        </div>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className="my-2 max-w-3xl mx-auto">
        <div className="rounded-xl bg-[#201f1d] border border-[#2d2b27] px-3.5 py-2 text-[11px] text-[#96928a] select-text font-mono">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 max-w-3xl mr-auto leading-relaxed text-xs sm:text-sm text-[#eeeae4] select-text font-sans">
      <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1({ children }) {
              return <h1 className="text-base font-semibold text-[#eeeae4] mt-5 mb-2 font-sans tracking-tight">{children}</h1>;
            },
            h2({ children }) {
              return <h2 className="text-sm font-semibold text-[#eeeae4] mt-4 mb-2 font-sans tracking-tight">{children}</h2>;
            },
            h3({ children }) {
              return <h3 className="text-xs sm:text-sm font-semibold text-[#eeeae4] mt-3 mb-1.5 font-sans">{children}</h3>;
            },
            h4({ children }) {
              return <h4 className="text-xs font-semibold text-[#d8d5ce] mt-2.5 mb-1 font-sans">{children}</h4>;
            },
            p({ children }) {
              return <p className="mb-3 leading-relaxed text-[#d8d5ce]">{children}</p>;
            },
            ul({ children }) {
              return <ul className="space-y-1.5 my-2.5 pl-4 list-disc text-[#d8d5ce]">{children}</ul>;
            },
            ol({ children }) {
              return <ol className="space-y-1.5 my-2.5 pl-4 list-decimal text-[#d8d5ce]">{children}</ol>;
            },
            li({ children }) {
              return <li className="leading-relaxed">{children}</li>;
            },
            strong({ children }) {
              return <strong className="font-semibold text-[#eeeae4]">{children}</strong>;
            },
            code({ className, children, ...props }: any) {
              const isBlock = /language-(\w+)/.test(className || '');
              return isBlock ? (
                <code className={className} {...props}>
                  {children}
                </code>
              ) : (
                <code
                  className="px-1.5 py-0.5 rounded-md bg-[#282724] font-mono text-[11px] text-[#d9b98a] border border-[#383631]"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            pre({ children }) {
              return (
                <pre className="p-3.5 my-3 rounded-xl bg-[#181715] text-[#eeeae4] font-mono text-[11px] overflow-x-auto border border-[#2d2b27] leading-relaxed shadow-xs">
                  {children}
                </pre>
              );
            },
            blockquote({ children }) {
              return (
                <blockquote className="border-l-2 border-[#c66b4d]/70 pl-3.5 my-2.5 text-[#96928a] italic">
                  {children}
                </blockquote>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
        {isStreaming && (
          <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-[#c66b4d] animate-pulse" />
        )}
      </div>
    </div>
  );
};