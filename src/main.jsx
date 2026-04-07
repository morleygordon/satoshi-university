import React from 'react';
import ReactDOM from 'react-dom/client';
import SatoshiUniversity from './App.jsx';

// Error boundary for debugging
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return React.createElement('div', {
        style: { padding: 40, color: '#ef4444', fontFamily: 'monospace', background: '#0a0c14', minHeight: '100vh' }
      },
        React.createElement('h2', null, 'Something went wrong'),
        React.createElement('pre', { style: { whiteSpace: 'pre-wrap', marginTop: 16, color: '#f0c040' } }, this.state.error.toString()),
        React.createElement('button', {
          onClick: () => { localStorage.clear(); window.location.reload(); },
          style: { marginTop: 20, padding: '10px 20px', background: '#f0c040', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }
        }, 'Reset & Reload')
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  React.createElement(ErrorBoundary, null,
    React.createElement(SatoshiUniversity)
  )
);

// PWA — register service worker only in production
if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
