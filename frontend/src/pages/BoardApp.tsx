import { useState } from "react";
import { BoardListPage } from "./BoardListPage";
import { BoardPage } from "./BoardPage";

interface BoardAppProps {
  initialBoardId: string | null;
}

/** Switches between the board list and a single open board — a board
 * accepted via an invite link lands here already selected. BoardApp only
 * ever mounts once `initialBoardId` is settled (App renders AcceptInvitePage
 * until then), so a lazy initial state is enough — no effect needed to keep
 * it in sync after that. */
export function BoardApp({ initialBoardId }: BoardAppProps) {
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(() => initialBoardId);

  if (!selectedBoardId) {
    return <BoardListPage onSelect={setSelectedBoardId} />;
  }

  return <BoardPage boardId={selectedBoardId} onBack={() => setSelectedBoardId(null)} />;
}
