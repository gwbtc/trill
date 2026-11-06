import "@/styles/Messages.css";
import { useChannelsStore } from "@/state/channels";
import { channelRoute } from "@/logic/tlon/channels";
import { Hash, Users } from "lucide-react";
import { Link } from "wouter";

export default function Groups() {
  const status = useChannelsStore((state) => state.status);
  const error = useChannelsStore((state) => state.error);
  const groups = useChannelsStore((state) => state.groups);
  return (
    <div id="screen-groups" className="trill-screen messages-screen">
      <header className="trill-screen-header dm-inbox-header">
        <div className="dm-inbox-title-row">
          <h1>Groups</h1>
        </div>
      </header>
      {status === "error" ? (
        <div className="dm-empty-state" role="alert">
          <h2>Groups unavailable</h2>
          <p>{error}</p>
          <button onClick={() => useChannelsStore.getState().reconnect()}>
            Retry
          </button>
        </div>
      ) : status !== "ready" ? (
        <div className="dm-empty-state" role="status">
          Loading groups...
        </div>
      ) : (
        <>
          {error && (
            <div className="dm-chat-error" role="alert">
              Groups could not refresh.{" "}
              <button
                onClick={() =>
                  void useChannelsStore
                    .getState()
                    .refresh()
                    .catch(() => {})
                }
              >
                Retry
              </button>
            </div>
          )}
          {groups.size ? (
            <div className="chat-groups-list">
              {[...groups.values()].map((group) => (
                <section
                  key={group.id}
                  className="chat-group"
                  aria-label={group.title}
                >
                  <header>
                    <Users size={22} />
                    <div>
                      <h2>{group.title}</h2>
                      <p className="mono">{group.id}</p>
                    </div>
                  </header>
                  {group.channels.length ? (
                    <ul>
                      {group.channels.map((channel) => (
                        <li key={channel.id}>
                          <Link
                            href={channelRoute(channel.id)}
                            className="chat-channel-link"
                          >
                            <Hash size={19} />
                            <span>
                              <strong>{channel.title}</strong>
                              {channel.description && (
                                <small>{channel.description}</small>
                              )}
                            </span>
                            {!channel.joined && (
                              <small className="chat-channel-membership">
                                Not joined
                              </small>
                            )}
                            {channel.joined && channel.unread > 0 && (
                              <span className="dm-row-unread">
                                {channel.unread}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="chat-no-channels">
                      No accessible chat channels in this group.
                    </p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="dm-empty-state">
              <Users size={32} />
              <h2>No groups yet</h2>
              <p>
                Groups you join in Tlon will appear here with their chat
                channels.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
