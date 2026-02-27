'use client';
export const dynamic = 'force-dynamic';
import { TopBar } from '../../components/ui/top-bar';
import WarRoomClient from './war-room-client';

export default function WarRoomPage() {
  return (
    <>
      <TopBar
        title="War Room"
        subtitle="Real-time command center for automation intelligence"
      />
      <div className="page-content">
        <WarRoomClient />
      </div>
    </>
  );
}
