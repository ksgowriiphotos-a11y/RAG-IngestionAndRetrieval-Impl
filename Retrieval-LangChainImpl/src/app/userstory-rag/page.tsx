import Layout from '@/src/frontend/components/Layout';
import UserStoryForm from '@/src/frontend/components/UserStoryForm';
import CSVIngestControl from '@/src/frontend/components/CSVIngestControl';

export default function UserStoryRAGPage() {
    return (
        <Layout>
            <div className="max-w-4xl mx-auto">
                <UserStoryForm />
                <div className="border-t pt-6 mt-6">
                    <CSVIngestControl />
                </div>
            </div>
        </Layout>
    );
}