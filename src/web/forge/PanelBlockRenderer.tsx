import { ShieldAlert } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ForgePanelBlock } from "../../server/forge/types";
import { ShadowHtmlBlock } from "./ShadowHtmlBlock";

export function PanelBlockRenderer({ block }: { block: ForgePanelBlock }) {
  if (block.type === "html") return <ShadowHtmlBlock body={block.body} />;
  if (block.type === "approval") {
    return (
      <div className="rounded-xl border border-[#614f2e] bg-[#2a2419] p-3">
        <div className="flex items-center gap-2 font-medium text-[#e0b963] text-xs">
          <ShieldAlert size={14} /> {block.title}
        </div>
        <p className="mt-2 mb-0 whitespace-pre-wrap text-[11px] leading-5 text-[#bdb29d]">{block.description}</p>
      </div>
    );
  }
  if (block.type !== "markdown") return null;
  return (
    <div className="max-w-full text-xs leading-5 text-[#c5c5c5] [&_a]:text-[#9db8dd] [&_blockquote]:m-0 [&_blockquote]:border-[#444] [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-[#171717] [&_code]:px-1 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_li]:my-1 [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[#171717] [&_pre]:p-3 [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.body}</ReactMarkdown>
    </div>
  );
}
