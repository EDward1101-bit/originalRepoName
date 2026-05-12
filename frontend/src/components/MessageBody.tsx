import ReactMarkdown from 'react-markdown';

interface MessageBodyProps {
  body: string;
  isDeleted: boolean;
}

export default function MessageBody({ body, isDeleted }: MessageBodyProps) {
  if (isDeleted) {
    return (
      <p className="text-[15px] leading-[1.4rem] text-[var(--text-muted)] italic">
        {body}
      </p>
    );
  }

  return (
    <ReactMarkdown
      components={{
        // Paragraph — no extra margin between chat lines
        p: ({ children }) => (
          <p className="text-[15px] leading-[1.4rem] text-[var(--text-normal)] break-words">
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="font-bold text-[var(--text-normal)]">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-[var(--text-normal)]">{children}</em>
        ),
        del: ({ children }) => (
          <del className="line-through text-[var(--text-muted)]">{children}</del>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.startsWith('language-');
          return isBlock ? (
            <code className="block w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-4 py-3 my-1 text-[13px] font-mono text-[var(--text-normal)] whitespace-pre overflow-x-auto">
              {children}
            </code>
          ) : (
            <code className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[13px] font-mono text-[var(--text-normal)]">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <div className="my-1">{children}</div>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-[var(--brand)] pl-3 my-1 text-[var(--text-muted)]">
            {children}
          </blockquote>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside text-[15px] text-[var(--text-normal)] my-1 space-y-0.5">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside text-[15px] text-[var(--text-normal)] my-1 space-y-0.5">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-[1.4rem]">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--brand)] underline underline-offset-2 hover:opacity-80"
          >
            {children}
          </a>
        ),
        h1: ({ children }) => (
          <h1 className="text-[18px] font-bold text-[var(--text-normal)] my-1">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-[16px] font-bold text-[var(--text-normal)] my-1">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-[15px] font-semibold text-[var(--text-normal)] my-1">{children}</h3>
        ),
        img: () => null,
      }}
    >
      {body}
    </ReactMarkdown>
  );
}
