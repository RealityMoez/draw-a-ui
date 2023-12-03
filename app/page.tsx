"use client";

import dynamic from "next/dynamic";
import "@tldraw/tldraw/tldraw.css";
import { useEditor } from "@tldraw/tldraw";
import { getSvgAsImage } from "@/lib/getSvgAsImage";
import { blobToBase64 } from "@/lib/blobToBase64";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { PreviewModal } from "@/components/PreviewModal";
import { useCookies } from 'react-cookie';

const Tldraw = dynamic(async () => (await import("@tldraw/tldraw")).Tldraw, {
  ssr: false,
});

export default function Home() {
  const [html, setHtml] = useState<null | string>(null);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHtml(null);
      }
    };
    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  });

  return (
    <>
      <div className={`w-screen h-screen`}>
        <Tldraw persistenceKey="tldraw">
          <ExportButton setHtml={setHtml} />
        </Tldraw>
      </div>
      {html &&
        ReactDOM.createPortal(
          <div
            className="fixed top-0 left-0 right-0 bottom-0 flex justify-center items-center"
            style={{ zIndex: 2000, backgroundColor: "rgba(0,0,0,0.5)" }}
            onClick={() => setHtml(null)}
          >
            <PreviewModal html={html} setHtml={setHtml} />
          </div>,
          document.body
        )}
    </>
  );
}

function ExportButton({ setHtml }: { setHtml: (html: string) => void }) {
  const editor = useEditor();
  const [loading, setLoading] = useState(false);
  const [cookies, setCookie] = useCookies(['OPENAI_API_KEY']);
  const [OPENAI_API_KEY, setOPENAI_API_KEY] = useState<string | null>(cookies.OPENAI_API_KEY || null);
  // A tailwind styled button that is pinned to the bottom right of the screen
  return (
    <button
      onClick={async (e) => {
        e.preventDefault();
        setLoading(true);
      
        // Check for API key in cookies or environment variables
        const cookies = document.cookie;
        const OPENAI_API_KEY = cookies ? (new Map(cookies.split(';').map(cookie => {
          const [key, value] = cookie.trim().split('=');
          return [key, value] as [string, string];
        }))).get('OPENAI_API_KEY') : process.env.OPENAI_API_KEY;
      
        // If API key is missing, prompt the user to enter it
        if (OPENAI_API_KEY == "") {
          const userKey = window.prompt('Please enter your (vaild) OpenAI API key:');
          if (userKey) {
            setCookie('OPENAI_API_KEY', userKey, { path: '/' });
            setOPENAI_API_KEY(userKey);
          } else {
            setLoading(false);
            return;
          }
        }

        try {
          e.preventDefault();
          const svg = await editor.getSvg(
            Array.from(editor.currentPageShapeIds)
          );
          if (!svg) {
            return;
          }
          const png = await getSvgAsImage(svg, {
            type: "png",
            quality: 1,
            scale: 1,
          });
          const dataUrl = await blobToBase64(png!);
          const resp = await fetch("/api/toHtml", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Cookie": document.cookie,
            },
            body: JSON.stringify({ image: dataUrl }),
          });

          const json = await resp.json();

          if (json.error) {
            alert(JSON.stringify(json.error.message).replaceAll(`"`, ''));
            setCookie('OPENAI_API_KEY', "", { path: '/' });
            return;
          }

          const message = json.choices[0].message.content;
          const start = message.indexOf("<!DOCTYPE html>");
          const end = message.indexOf("</html>");
          const html = message.slice(start, end + "</html>".length);
          setHtml(html);
        } finally {
          setLoading(false);
        }
      }}
      className="fixed bottom-4 right-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ="
      style={{ zIndex: 1000 }}
      disabled={loading}
    >
      {loading ? (
        <div className="flex justify-center items-center ">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        </div>
      ) : (
        "Make Real"
      )}
    </button>
  );
}
