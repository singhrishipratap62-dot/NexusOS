import { PageSkeleton } from '../../components/ui/loading-skeleton';
import { TopBar } from '../../components/ui/top-bar';

export default function RunsLoading() {
    return (
        <>
            <TopBar title="Automation Runs" subtitle="Loading..." />
            <PageSkeleton statCount={3} tableRows={5} />
        </>
    );
}
