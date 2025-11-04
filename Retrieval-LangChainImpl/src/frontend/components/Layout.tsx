import { ReactNode } from 'react';
import styles from '@/styles/layout.module.css';

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    return (
        <div className={styles.pageRoot}>
            <div className={styles.appBackground} aria-hidden />

            <aside className={styles.sidebar}>
                <div className={styles.brand}>RAG Dashboard</div>
                 <nav className={styles.backButton} aria-label="Back to Home">
                    <a href="/" className={styles.menuItem}>
                        ←  Back To Home
                    </a>
                </nav>
                <nav className={styles.menu} aria-label="Main menu">
                    <a href="/userstory-rag" className={styles.menuItem}>
                        Userstory - RAG pipeline search
                    </a>
                </nav>
               
                
            </aside>

            <main className={styles.content}>
                <div className={styles.panel} style={{ padding: '1rem' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}