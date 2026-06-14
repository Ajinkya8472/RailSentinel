/**
 * src/routes/index.jsx
 */

import React, {
  lazy,
  memo,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
  useMatches,
  useNavigate,
} from 'react-router-dom';

import { motion, AnimatePresence } from 'motion/react';

import AppShell from '../layouts/AppShell.jsx';
import useUiStore from '../store/uiStore';
import ChatPanel from '../components/Chat/ChatPanel';

const LandingPage       = lazy(() => import('../pages/LandingPage.jsx'));
const Dashboard         = lazy(() => import('../pages/Dashboard.jsx'));
const IncidentPage      = lazy(() => import('../pages/IncidentPage.jsx'));
const TrainPage         = lazy(() => import('../pages/TrainPage.jsx'));
const PredictivePage    = lazy(() => import('../pages/PredictivePage.jsx'));
const MapPage           = lazy(() => import('../pages/MapPage.jsx'));
const CrowdPage         = lazy(() => import('../pages/CrowdPage.jsx'));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage.jsx'));
const SchedulePage      = lazy(() => import('../pages/SchedulePage.jsx'));
const EnergyPage        = lazy(() => import('../pages/EnergyPage.jsx'));

export const ROUTE_DEFS = [
  { id: 'landing',       path: '/',              label: 'RailSentinel',            module: 'Landing',   icon: 'home',             shell: false },
  { id: 'dashboard',     path: '/dashboard',     label: 'Dashboard',               module: 'Dashboard', icon: 'layout-dashboard', shell: true  },
  { id: 'incidents',     path: '/incidents',     label: 'Incidents',               module: 'M1',        icon: 'alert-triangle',   shell: true  },
  { id: 'trains',        path: '/trains',        label: 'Train Operations',        module: 'M2',        icon: 'train',            shell: true  },
  { id: 'map',           path: '/map',           label: 'Network Map',             module: 'Map',       icon: 'map',              shell: true  },
  { id: 'crowd',         path: '/crowd',         label: 'Crowd Intelligence',      module: 'M3',        icon: 'users',            shell: true  },
  { id: 'predictive',    path: '/predictive',    label: 'Predictive Intelligence', module: 'M4',        icon: 'cpu',              shell: true  },
  { id: 'notifications', path: '/notifications', label: 'Notifications',           module: 'M5',        icon: 'bell',             shell: true  },
  { id: 'schedule',      path: '/schedule',      label: 'Smart Schedule',          module: 'M6',        icon: 'calendar',         shell: true  },
  { id: 'energy',        path: '/energy',        label: 'Energy Optimization',     module: 'M7',        icon: 'zap',              shell: true  },
];

const ROUTE_BY_PATH = Object.fromEntries(ROUTE_DEFS.map((r) => [r.path, r]));

function PageLoader() {
  return (
    <div
      className="route-page-loader"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '1 1 auto', minHeight: '24rem', gap: '0.5rem' }}
    >
      {[0, 1, 2].map((i) => (
        <span key={i} aria-hidden="true" style={{
          width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6',
          display: 'inline-block', animation: `rs-bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
        }} />
      ))}
      <style>{`@keyframes rs-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1.0); opacity: 1; } }`}</style>
    </div>
  );
}

function NotFoundPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <main role="main" aria-label="Page not found" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', gap: '1rem', background: '#0f172a', color: '#f8fafc',
      fontFamily: "'Inter', system-ui, sans-serif", padding: '2rem', textAlign: 'center',
    }}>
      <span aria-hidden="true" style={{ fontSize: '4rem', lineHeight: 1 }}>🚂</span>
      <h1 style={{ fontSize: '2.25rem', fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        404 — Off the Rails
      </h1>
      <p style={{ fontSize: '1rem', color: '#94a3b8', maxWidth: '28rem', lineHeight: 1.6, margin: 0 }}>
        The route <code style={{ background: '#1e293b', padding: '0.1em 0.45em', borderRadius: '4px', color: '#f87171', fontFamily: 'monospace', fontSize: '0.9em' }}>{pathname}</code> does not exist in the RailSentinel network.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" onClick={() => navigate('/dashboard')} style={{ padding: '0.6rem 1.4rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: '#fff', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
          Go to Dashboard
        </button>
        <button type="button" onClick={() => navigate(-1)} style={{ padding: '0.6rem 1.4rem', borderRadius: '8px', border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer' }}>
          Go Back
        </button>
      </div>
    </main>
  );
}

const SHELL_NAV_ITEMS = ROUTE_DEFS
  .filter((r) => r.shell)
  .map((r) => ({ id: r.id, label: r.label, icon: r.icon, path: r.path, module: r.module }));

const SHELL_UTILITY_ITEMS = [
  { id: 'chat',     label: 'AI Assistant', icon: 'message-square' },
  { id: 'settings', label: 'Settings',     icon: 'settings'       },
  { id: 'help',     label: 'Help',         icon: 'help-circle'    },
];

function AppShellRoute() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const matches = useMatches();

  const aiAssistantOpen  = useUiStore((s) => s.aiAssistantOpen);
  const openAiAssistant  = useUiStore((s) => s.openAiAssistant);
  const closeAiAssistant = useUiStore((s) => s.closeAiAssistant);

  // ── Chat state ────────────────────────────────────────────────────────────
  const [messages,  setMessages]  = useState([]);
  const [isTyping,  setIsTyping]  = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const handleSend = useCallback(async (text) => {
    if (!text?.trim() || isTyping) return;

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const history = [...messagesRef.current, userMsg].map((m) => ({
      role:    m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    try {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          question: text.trim(),
        }),
      });

      if (!res.ok) throw new Error(`Backend returned ${res.status}`);

      const data = await res.json();
      const reply = data.answer ?? data.reply ?? data.response ?? JSON.stringify(data);

      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: reply },
      ]);
    } catch (err) {
      console.error('[Chat] /api/chat failed:', err.message);
      setMessages((prev) => [
        ...prev,
        {
          id:      `e-${Date.now()}`,
          role:    'assistant',
          isError: true,
          content: `⚠️ Could not reach AI backend at ${BASE_URL}/api/chat. Make sure the backend server is running.`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, BASE_URL]);

  const handleCloseChat = useCallback(() => closeAiAssistant(), [closeAiAssistant]);

  const handleAssistant = useCallback(() => openAiAssistant(), [openAiAssistant]);

  const shellUtilityItems = useMemo(() => {
    return SHELL_UTILITY_ITEMS.map((item) =>
      item.id === 'chat' ? { ...item, onClick: handleAssistant } : item
    );
  }, [handleAssistant]);

  const activeRouteDef  = ROUTE_BY_PATH[pathname] ?? null;
  const activeItemId    = activeRouteDef?.id ?? 'dashboard';
  const activeLabel     = activeRouteDef?.label ?? 'Command Center';

  const breadcrumbs = matches
    .filter((m) => m.handle?.breadcrumb)
    .map((m) => ({ label: m.handle.breadcrumb, path: m.pathname }));

  const shellBreadcrumbs = breadcrumbs.length > 0
    ? breadcrumbs
    : [{ label: 'RailSentinel', path: '/' }, { label: activeLabel, path: pathname }];

  const handleNavigate = useCallback(
    (item) => { if (item?.path) navigate(item.path); },
    [navigate]
  );

  const handleNavigateHome = useCallback(() => navigate('/dashboard'), [navigate]);

  const [searchValue, setSearchValue] = useState('');
  const handleSearchChange = useCallback((value) => setSearchValue(value), []);
  const handleSearchSubmit = useCallback((value) => setSearchValue(value), []);

  return (
    <>
      <AppShell
        systemState="ready"
        activeContextLabel={activeLabel}
        breadcrumbs={shellBreadcrumbs}
        navigationItems={SHELL_NAV_ITEMS}
        utilityItems={shellUtilityItems}
        activeItemId={activeItemId}
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        onNavigate={handleNavigate}
        onNavigateHome={handleNavigateHome}
        onOpenAssistant={handleAssistant}
      >
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: 'linear' }}
              style={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column', height: '100%' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </AppShell>

      {aiAssistantOpen && (
        <div className="fixed inset-y-0 right-0 w-[450px] z-[100] shadow-2xl border-l border-border-default bg-surface-shell flex flex-col">
          <ChatPanel
            messages={messages}
            isTyping={isTyping}
            onSend={handleSend}
            onClose={handleCloseChat}
          />
        </div>
      )}
    </>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Suspense fallback={<PageLoader />}><LandingPage /></Suspense>,
    handle: { breadcrumb: 'RailSentinel' },
  },
  {
    element: <AppShellRoute />,
    children: [
      { path: '/dashboard',     element: <Dashboard />,         handle: { breadcrumb: 'Dashboard' } },
      { path: '/incidents',     element: <IncidentPage />,      handle: { breadcrumb: 'Incidents' } },
      { path: '/trains',        element: <TrainPage />,         handle: { breadcrumb: 'Train Operations' } },
      { path: '/map',           element: <MapPage />,           handle: { breadcrumb: 'Network Map' } },
      { path: '/crowd',         element: <CrowdPage />,         handle: { breadcrumb: 'Crowd Intelligence' } },
      { path: '/predictive',    element: <PredictivePage />,    handle: { breadcrumb: 'Predictive Intelligence' } },
      { path: '/notifications', element: <NotificationsPage />, handle: { breadcrumb: 'Notifications' } },
      { path: '/schedule',      element: <SchedulePage />,      handle: { breadcrumb: 'Smart Schedule' } },
      { path: '/energy',        element: <EnergyPage />,        handle: { breadcrumb: 'Energy Optimization' } },
      { path: '/home',          element: <Navigate to="/dashboard" replace /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

function AppRouter() {
  return <RouterProvider router={router} />;
}

export default memo(AppRouter);
export { router, AppShellRoute, NotFoundPage, PageLoader, SHELL_NAV_ITEMS };