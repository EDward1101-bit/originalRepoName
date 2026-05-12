import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useChatContext } from '../ChatContext';
import { useTranslation } from '../LanguageContext';
import { X, MessageSquare } from 'lucide-react';

interface PushNotification {
  id: string;
  senderXmpp: string;
  senderDisplayName: string;
  senderAvatar?: string;
  message: string;
  timestamp: number;
}

const DISMISS_AFTER_MS = 5500;

export default function PushNotificationBar() {
  const { messages, myUsername, getUserProfile } = useChatContext();
  const location = useLocation();
  const { t } = useTranslation();
  const locationRef = useRef(location.pathname);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  // Track the last message we've seen to detect brand-new incoming ones
  const lastSeenMsgIdRef = useRef<string | null>(null);
  // Track which notifications have been dismissed (for slide-out animation)
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());

  // Stable map of notif.id -> auto-dismiss timeout handle.
  // Stored in a ref so timers survive effect re-runs caused by messages updates.
  const timerMapRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});


  const dismiss = useCallback((notifId: string) => {
    // Cancel the auto-dismiss timer if it hasn't fired yet
    if (timerMapRef.current[notifId]) {
      clearTimeout(timerMapRef.current[notifId]);
      delete timerMapRef.current[notifId];
    }
    setDismissing((prev) => new Set([...prev, notifId]));
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      setDismissing((prev) => {
        const next = new Set(prev);
        next.delete(notifId);
        return next;
      });
    }, 350); // matches CSS transition duration
  }, []);

  // Watch for new incoming messages
  useEffect(() => {
    if (!messages.length) return;

    const latestMsg = messages[messages.length - 1];

    // Ignore our own sent messages
    if (latestMsg.type !== 'received') return;

    // Deduplicate: only fire if this is genuinely a new message
    if (latestMsg.id === lastSeenMsgIdRef.current) return;
    lastSeenMsgIdRef.current = latestMsg.id;

    // Don't notify for messages older than 10 seconds (e.g. history load on startup)
    if (Date.now() - latestMsg.time.getTime() > 10_000) return;

    const senderXmpp = latestMsg.otherParty;

    // Don't notify for our own username (safety)
    if (senderXmpp === myUsername) return;

    // Don't show a toast if the user is already viewing this DM
    const activePath = locationRef.current;
    if (activePath === `/dms/${senderXmpp}`) return;

    const profile = getUserProfile(senderXmpp);
    const displayName = profile?.username || senderXmpp;
    const avatarUrl = profile?.avatarUrl;

    const notif: PushNotification = {
      id: latestMsg.id,
      senderXmpp,
      senderDisplayName: displayName,
      senderAvatar: avatarUrl,
      message: latestMsg.body,
      timestamp: Date.now(),
    };

    setNotifications((prev) => {
      // Max 3 stacked notifications — evict oldest if needed
      const trimmed = prev.length >= 3 ? prev.slice(1) : prev;
      return [...trimmed, notif];
    });

    // Schedule auto-dismiss in the stable ref map (NOT as effect cleanup)
    timerMapRef.current[notif.id] = setTimeout(() => dismiss(notif.id), DISMISS_AFTER_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    const timers = timerMapRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);


  if (notifications.length === 0) return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 z-50 flex flex-col items-center gap-2 pt-3 px-4 pointer-events-none"
      aria-live="polite"
    >
      {notifications.map((notif) => {
        const isDismissing = dismissing.has(notif.id);
        const isMedia = notif.message.includes('chat-media') || notif.message.includes('supabase');
        const preview = isMedia ? t('attachment') : notif.message;

        return (
          <div
            key={notif.id}
            className="pointer-events-auto w-full max-w-sm"
            style={{
              animation: isDismissing
                ? 'pushNotifSlideOut 0.35s cubic-bezier(0.4, 0, 1, 1) forwards'
                : 'pushNotifSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <div
              className="relative flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, var(--overlay-surface-start) 0%, var(--overlay-surface-end) 100%)',
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Progress bar */}
              <div
                className="absolute bottom-0 left-0 h-[2px] bg-(--brand) rounded-full"
                style={{
                  animation: `pushNotifProgress ${DISMISS_AFTER_MS}ms linear forwards`,
                }}
              />

              {/* Avatar */}
              <div className="relative shrink-0 w-10 h-10">
                <div className="w-full h-full rounded-full overflow-hidden bg-(--brand) flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {notif.senderAvatar ? (
                    <img
                      src={notif.senderAvatar}
                      alt={notif.senderDisplayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    notif.senderDisplayName[0]?.toUpperCase()
                  )}
                </div>
                {/* Small message icon badge */}
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-(--brand) flex items-center justify-center border-[2px] border-(--overlay-border)">
                  <MessageSquare size={9} className="text-white" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-bold text-white truncate">
                    {notif.senderDisplayName}
                  </span>
                  <span className="text-[11px] text-white/40 font-medium shrink-0">
                    {t('sent_you_message')}
                  </span>
                </div>
                <p className="text-[13px] text-white/70 truncate leading-snug">
                  {preview}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => dismiss(notif.id)}
                  className="text-[12px] font-bold text-(--brand) bg-(--brand)/15 hover:bg-(--brand)/25 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {t('reply')}
                </button>
                <button
                  onClick={() => dismiss(notif.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Keyframe animations injected as a style tag */}
      <style>{`
        @keyframes pushNotifSlideIn {
          from { opacity: 0; transform: translateY(-120%) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)      scale(1); }
        }
        @keyframes pushNotifSlideOut {
          from { opacity: 1; transform: translateY(0)       scale(1); }
          to   { opacity: 0; transform: translateY(-120%) scale(0.95); }
        }
        @keyframes pushNotifProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
