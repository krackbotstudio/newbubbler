import React from 'react';
import { Text, ScrollView } from 'react-native';
import { registerRootComponent } from 'expo';
import './pwa-google-maps-popup';
import App from '../customer-mobile/App';

/**
 * React Native Web often mounts into #root without inheriting full viewport height,
 * which looks like a blank white page. Match post-export PWA shell behavior in dev.
 */
function applyWebRootLayout() {
  if (typeof document === 'undefined') return;
  const { documentElement: html, body } = document;
  const root = document.getElementById('root');
  if (html) {
    html.style.minHeight = '100%';
    html.style.height = '100%';
  }
  if (body) {
    body.style.minHeight = '100%';
    body.style.height = '100%';
    body.style.margin = '0';
  }
  if (root) {
    root.style.minHeight = '100%';
    root.style.height = '100%';
    root.style.flex = '1';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
  }
}

applyWebRootLayout();

class CustomerPwaRootBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message
        ? String(this.state.error.message)
        : String(this.state.error);
      return React.createElement(
        ScrollView,
        {
          style: { flex: 1, backgroundColor: '#fafafa' },
          contentContainerStyle: {
            padding: 24,
            flexGrow: 1,
            justifyContent: 'center',
          },
        },
        React.createElement(
          Text,
          { style: { fontWeight: '700', fontSize: 18, marginBottom: 12, color: '#111' } },
          'Customer PWA could not render',
        ),
        React.createElement(
          Text,
          {
            style: { color: '#444', marginBottom: 12, fontSize: 14 },
          },
          'Copy the same .env as apps/customer-mobile (at least EXPO_PUBLIC_API_URL). Open the browser devtools console for the full stack trace.',
        ),
        React.createElement(Text, { selectable: true, style: { fontSize: 13, color: '#b00020' } }, msg),
      );
    }
    return this.props.children;
  }
}

function Root() {
  return React.createElement(CustomerPwaRootBoundary, null, React.createElement(App));
}

registerRootComponent(Root);
