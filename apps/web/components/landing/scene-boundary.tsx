'use client';

import { Component, type ReactNode } from 'react';

/** If WebGL fails mid-flight, the page simply goes on without its scene. */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
