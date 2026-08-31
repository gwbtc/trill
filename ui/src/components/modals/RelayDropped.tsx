import { GLOBAL_RELAY_URL } from "@/logic/constants";
import triangles from "@/assets/triangles.svg";
import { useRelayActions } from "@/hooks/useRelayActions";

export default function RelayDroppedDialog({ url }: { url: string }) {
  const { addRelay, isAddingRelay } = useRelayActions();
  async function handleRetry(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await addRelay(url);
  }

  return (
    <div className="confirmation-dialog">
      {url === GLOBAL_RELAY_URL ? (
        <h3>Your connection to the global relay has dropped</h3>
      ) : (
        <h3>
          The relay {url} is unreachable — automatic reconnection gave up
          after several attempts
        </h3>
      )}
      {isAddingRelay ? (
        <div className="loading-spinner">
          <img src={triangles} alt="Loading..." />
        </div>
      ) : (
        <div>
          <p>Keep trying?</p>
          <div className="confirmation-buttons">
            <button className="btn-confirm" onClick={handleRetry}>
              Yes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
