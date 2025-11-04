"use client";

import React, { useState } from 'react';
import CSVIngestControl from '@/components/CSVIngestControl';
import NavButton from '@/components/NavButton';
import styles from '@/styles/layout.module.css';

type ViewKey = 'home' | 'ingestion' | 'retrieval' | 'env';

export default function Home() {
  const [view, setView] = useState<ViewKey>('home');

  return (
    <div className={styles.pageRoot}>
      <div className={styles.appBackground} aria-hidden />
      <aside className={styles.sidebar}>
        <div className={styles.brand}>RAG Dashboard</div>
        <nav className={styles.menu} aria-label="Main menu">
          <button
            className={`${styles.menuItem} ${view === 'retrieval' ? styles.active : ''}`}
            onClick={() => setView('retrieval')}
          >
            🔎 User Story - Retrieval
          </button>

          <button
            className={`${styles.menuItem} ${view === 'ingestion' ? styles.active : ''}`}
            onClick={() => setView('ingestion')}
          >
            🧾 User Story - Ingestion
          </button>

          <button
            className={`${styles.menuItem} ${view === 'env' ? styles.active : ''}`}
            onClick={() => setView('env')}
          >
            ⚙️ Environment Configuration
          </button>
        </nav>
      </aside>

      <main className={styles.content}>
        {view === 'ingestion' && (
          <section className={`${styles.glassCard} ${styles.panel}`}>
            <h1 className={styles.pageTitle}>User Story RAG Pipeline</h1>
            <p className={styles.muted}>
              Upload user story CSV files here to ingest into the system. After ingestion you
              can navigate to the RAG Pipeline Search page to run retrievals and view rankings.
            </p>

            <div style={{ marginTop: '1rem' }}>
              <div className={styles.glassCard}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  Upload User Stories
                </h2>
                <CSVIngestControl />
              </div>
            </div>
          </section>
        )}

        {view === 'retrieval' && (
          <section className={`${styles.glassCard} ${styles.panel}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 className={styles.pageTitle}>RAG Pipeline Search</h1>
                <p className={styles.muted}>
                  Use the RAG pipeline to search the ingested user stories and analyze retrieval
                  results.
                </p>
              </div>

              <div style={{marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button className={styles.backButton} onClick={() => setView('home')}>
                  ← Back to Home
                </button>
                <NavButton href="/userstory-rag" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-md font-medium transition-colors">
                  Open RAG Pipeline Search →
                </NavButton>
              </div>
            </div>
          </section>
        )}

        {view === 'env' && (
          <section className={`${styles.glassCard} ${styles.panel}`}>
            <h1 className={styles.pageTitle}>Environment Configuration</h1>
            <p className={styles.muted}>
              Manage environment variables and API keys for the application. These settings are
              visual-only in this UI — backend configuration still uses the existing .env files.
            </p>

            <div style={{ marginTop: '1rem' }}>
              <div className={styles.glassCard}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  API Settings
                </h2>
                <p className={styles.muted}>Visual editor coming soon. Use .env files for real updates.</p>
              </div>
            </div>
          </section>
        )}

        {view === 'home' && (
          <section className={`${styles.glassCard} ${styles.panel}`}>
            <h1 className={styles.pageTitle}>Welcome to the RAG Dashboard</h1>
            <p className={styles.muted}>Choose an action from the left menu or tap a card below.</p>

            <div className={styles.homeGrid}>
              <div className={styles.homeCard} onClick={() => setView('retrieval')}>
                <h3 style={{ marginBottom: '0.5rem' }}>RAG Pipeline Search</h3>
                <p className={styles.muted}>Open the retrieval UI to search ingested stories.</p>
              </div>

              <div className={styles.homeCard} onClick={() => setView('ingestion')}>
                <h3 style={{ marginBottom: '0.5rem' }}>User Stories Ingestion</h3>
                <p className={styles.muted}>Upload CSV files to ingest user stories into the system.</p>
              </div>

              <div className={styles.homeCard} onClick={() => setView('env')}>
                <h3 style={{ marginBottom: '0.5rem' }}>Environment Configuration</h3>
                <p className={styles.muted}>View or modify environment-related settings (UI only).</p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
