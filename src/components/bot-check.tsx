"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}
export function BotCheck({
  onToken,
  reset,
  action,
  errorText,
  retryText,
}: {
  onToken: (token: string) => void;
  reset: number;
  action: "quote" | "admin_login";
  errorText: string;
  retryText: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [scriptVersion, setScriptVersion] = useState(0);
  useEffect(() => {
    if (!loaded || !host.current || !window.turnstile) return;
    widget.current = window.turnstile.render(host.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      action,
      callback: (token: string) => {
        onToken(token);
        setFailed(false);
      },
      "expired-callback": () => onToken(""),
      "error-callback": () => {
        onToken("");
        setFailed(true);
      },
      theme: "light",
      size: "flexible",
    });
    return () => {
      if (widget.current !== undefined)
        window.turnstile?.remove(widget.current);
      widget.current = undefined;
    };
  }, [loaded, onToken, action]);
  useEffect(() => {
    if (widget.current !== undefined) window.turnstile?.reset(widget.current);
  }, [reset]);
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return null;
  return (
    <div className="bot-check">
      <Script
        key={scriptVersion}
        src={
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" +
          (scriptVersion ? "&retry=" + scriptVersion : "")
        }
        onReady={() => {
          setLoaded(true);
          setFailed(false);
        }}
        onError={() => {
          setFailed(true);
          onToken("");
        }}
      />
      <div ref={host} />
      {failed && (
        <div role="alert">
          <p>{errorText}</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              onToken("");
              if (widget.current !== undefined)
                window.turnstile?.reset(widget.current);
              else {
                setLoaded(false);
                setScriptVersion((v) => v + 1);
              }
            }}
          >
            {retryText}
          </button>
        </div>
      )}
    </div>
  );
}
