import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  return <main><p className="eyebrow">SHARED EXPENSES, SIMPLIFIED</p><h1>Splitwise Lite</h1><p className="intro">A simple place to track group expenses and see who owes whom.</p><section><h2>Your groups</h2><div className="empty"><span className="icon">＋</span><h3>Start a group</h3><p>Create a group to add expenses and split them fairly.</p><button onClick={() => alert('Group creation is coming next.')}>Create group</button></div></section><footer>Local-first expense splitting</footer></main>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
