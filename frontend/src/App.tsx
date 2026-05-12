import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Auth from './Auth';
import Layout from './Layout';
import { useAuth } from './AuthContext';
import { ChatProvider } from './ChatContext';
import { MucProvider } from './MucContext';
import { BotProvider } from './BotContext';
import { useTranslation } from './LanguageContext';

const Chat = React.lazy(() => import('./Chat'));
const DMsPage = React.lazy(() => import('./DMsPage'));
const RoomsPage = React.lazy(() => import('./RoomsPage'));
const RoomChat = React.lazy(() => import('./RoomChat'));
const RoomsRedirect = React.lazy(() => import('./RoomsRedirect'));
const BotsPage = React.lazy(() => import('./BotsPage'));

function AuthenticatedRoutes() {
  return (
    <ChatProvider>
      <BotProvider>
        <MucProvider>
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
              <div className="w-8 h-8 rounded-full border-4 border-[var(--brand)]/20 border-t-[var(--brand)] animate-spin" />
            </div>
          }>
            <Routes>
              <Route path="/dms" element={<Layout><DMsPage /></Layout>} />
              <Route path="/dms/:username" element={<Layout><Chat /></Layout>} />
              <Route path="/rooms" element={<Layout><RoomsRedirect /></Layout>} />
              <Route path="/rooms/explore" element={<Layout><RoomsPage /></Layout>} />
              <Route path="/rooms/:roomName" element={<Layout><RoomChat /></Layout>} />
              <Route path="/bots" element={<Layout><BotsPage /></Layout>} />
              <Route path="*" element={<Layout><Navigate to="/dms" replace /></Layout>} />
            </Routes>
          </Suspense>
        </MucProvider>
      </BotProvider>
    </ChatProvider>
  );
}

function App() {
  const { user, password, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="h-screen w-full bg-[var(--bg-primary)] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl shadow-xl overflow-hidden">
          <div className="p-8">
            <div className="flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--brand)] text-white flex items-center justify-center shadow-sm">
                <div className="w-6 h-6 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
              </div>
            </div>

            <div className="mt-6 text-center">
              <h1 className="text-[20px] font-bold tracking-tight text-[var(--text-normal)]">{t('aether')}</h1>
              <p className="mt-1 text-[13px] font-medium text-[var(--text-muted)]">
                {t('connecting')}
              </p>
            </div>

            <div className="mt-7 space-y-3">
              <div className="h-3 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                <div className="h-full w-1/3 bg-[var(--brand)]/25 animate-pulse" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="h-10 rounded-2xl bg-[var(--bg-tertiary)] animate-pulse" />
                <div className="h-10 rounded-2xl bg-[var(--bg-tertiary)] animate-pulse" />
                <div className="h-10 rounded-2xl bg-[var(--bg-tertiary)] animate-pulse" />
              </div>
            </div>
          </div>

          <div className="h-1 bg-[var(--brand)]/20 overflow-hidden">
            <div className="h-full w-1/2 bg-[var(--brand)]/50 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!user || !password) {
    return <Auth />;
  }

  return <AuthenticatedRoutes />;
}

export default App;
