import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import ResearchPage from './pages/ResearchPage';
import ObservabilityPage from './pages/ObservabilityPage';

type View = 'research' | 'observability';

export default function App() {
  const { user, saveUser } = useAuth();
  const [view, setView] = useState<View>('research');

  if (!user) {
    return <LoginPage onLogin={saveUser} />;
  }

  if (view === 'observability') {
    return (
      <ObservabilityPage onBack={() => setView('research')} />
    );
  }

  return (
    <ResearchPage
      username={user.username}
      onViewObservability={() => setView('observability')}
    />
  );
}
