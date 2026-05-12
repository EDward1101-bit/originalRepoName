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

console.log('[App] Starting...');

function AuthenticatedRoutes() {
  console.log('[App] Rendering AuthenticatedRoutes');
  return (
    <ChatProvider>
      <BotProvider>
        <MucProvider>
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center bg-(--bg-primary)">
              <div className="w-8 h-8 rounded-full border-4 border-(--brand)/20 border-t-(--brand) animate-spin" />
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

  console.log('[App] Auth state:', { user: !!user, hasPassword: !!password, loading });

  if (loading) {
    return (
      <div className="h-screen w-full bg-(--bg-primary) flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-(--bg-secondary) border border-(--border) rounded-3xl shadow-xl overflow-hidden">
          <div className="p-8">
            <div className="flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-(--brand) text-white flex items-center justify-center shadow-sm">
                <div className="w-6 h-6 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
              </div>
            </div>

            <div className="mt-6 text-center">
              <h1 className="text-[20px] font-bold tracking-tight text-(--text-normal)">{t('aether')}</h1>
              <p className="mt-1 text-[13px] font-medium text-(--text-muted)">
                {t('connecting')}
              </p>
            </div>

            <div className="mt-7 space-y-3">
              <div className="h-3 rounded-full bg-(--bg-tertiary) overflow-hidden">
                <div className="h-full w-1/3 bg-(--brand)/25 animate-pulse" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="h-10 rounded-2xl bg-(--bg-tertiary) animate-pulse" />
                <div className="h-10 rounded-2xl bg-(--bg-tertiary) animate-pulse" />
                <div className="h-10 rounded-2xl bg-(--bg-tertiary) animate-pulse" />
              </div>
            </div>
          </div>

          <div className="h-1 bg-(--brand)/20 overflow-hidden">
            <div className="h-full w-1/2 bg-(--brand)/50 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!user || !password) {
    console.log('[App] No user/password, rendering Auth');
    return <Auth />;
  }

  return <AuthenticatedRoutes />;
}

export default App;
