import { PageSkeleton } from '../../components/ui/loading-skeleton';
import { TopBar } from '../../components/ui/top-bar';

export default function ReviewLoading() {
    return (
        <>
            <TopBar title="Review Queue" subtitle="Loading items..." />
            <PageSkeleton statCount={3} tableRows={5} />
        </>
    );
}
