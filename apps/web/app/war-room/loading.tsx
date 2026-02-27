import { PageSkeleton } from '../../components/ui/loading-skeleton';
import { TopBar } from '../../components/ui/top-bar';

export default function WarRoomLoading() {
    return (
        <>
            <TopBar title="War Room" subtitle="Loading opportunities..." />
            <PageSkeleton statCount={4} tableRows={6} />
        </>
    );
}
