import type { Poast } from "@/types/trill";
import yeschad from "@/assets/reacts/yeschad.png";
import cringe from "@/assets/reacts/cringe.png";
import cry from "@/assets/reacts/cry.png";
import doom from "@/assets/reacts/doom.png";
import galaxy from "@/assets/reacts/galaxy.png";
import gigachad from "@/assets/reacts/gigachad.png";
import pepechin from "@/assets/reacts/pepechin.png";
import pepeeyes from "@/assets/reacts/pepeeyes.png";
import pepegmi from "@/assets/reacts/pepegmi.png";
import pepesad from "@/assets/reacts/pepesad.png";
import pink from "@/assets/reacts/pink.png";
import soy from "@/assets/reacts/soy.png";
import chad from "@/assets/reacts/chad.png";
import pika from "@/assets/reacts/pika.png";
import facepalm from "@/assets/reacts/facepalm.png";
import Icon from "@/components/Icon";
import emojis from "@/logic/emojis.json";
import Modal from "../modals/Modal";
import useLocalState from "@/state/state";
import toast from "react-hot-toast";
import type { UserType } from "@/types/nostrill";
import type { AsyncRes } from "@/types/ui";

export function ReactModal({
  send,
}: {
  send: (s: string) => AsyncRes<number>;
}) {
  const { setModal } = useLocalState((s) => ({ setModal: s.setModal }));
  async function sendReact(e: React.MouseEvent, s: string) {
    e.stopPropagation();
    const res = await send(s);
    if ("ok" in res) setModal(null);
  }
  // todo one more meme
  return (
    <Modal>
      <div id="react-list">
        <span onMouseUp={(e) => sendReact(e, "❤️")}>️️❤️</span>
        <span onMouseUp={(e) => sendReact(e, "🤔")}>🤔</span>
        <span onMouseUp={(e) => sendReact(e, "😅")}>😅</span>
        <span onMouseUp={(e) => sendReact(e, "🤬")}>🤬</span>
        <span onMouseUp={(e) => sendReact(e, "😂")}>😂️</span>
        <span onMouseUp={(e) => sendReact(e, "🫡")}>🫡️</span>
        <span onMouseUp={(e) => sendReact(e, "🤢")}>🤢</span>
        <span onMouseUp={(e) => sendReact(e, "😭")}>😭</span>
        <span onMouseUp={(e) => sendReact(e, "😱")}>😱</span>
        <img
          onMouseUp={(e) => sendReact(e, "facepalm")}
          src={facepalm}
          alt=""
        />
        <span onMouseUp={(e) => sendReact(e, "👍")}>👍️</span>
        <span onMouseUp={(e) => sendReact(e, "👎")}>👎️</span>
        <span onMouseUp={(e) => sendReact(e, "☝")}>☝️</span>
        <span onMouseUp={(e) => sendReact(e, "🤝")}>🤝</span>️
        <span onMouseUp={(e) => sendReact(e, "🙏")}>🙏</span>
        <span onMouseUp={(e) => sendReact(e, "🤡")}>🤡</span>
        <span onMouseUp={(e) => sendReact(e, "👀")}>👀</span>
        <span onMouseUp={(e) => sendReact(e, "🎤")}>🎤</span>
        <span onMouseUp={(e) => sendReact(e, "💯")}>💯</span>
        <span onMouseUp={(e) => sendReact(e, "🔥")}>🔥</span>
        <img onMouseUp={(e) => sendReact(e, "yeschad")} src={yeschad} alt="" />
        <img
          onMouseUp={(e) => sendReact(e, "gigachad")}
          src={gigachad}
          alt=""
        />
        <img onMouseUp={(e) => sendReact(e, "pika")} src={pika} alt="" />
        <img onMouseUp={(e) => sendReact(e, "cringe")} src={cringe} alt="" />
        <img onMouseUp={(e) => sendReact(e, "pepegmi")} src={pepegmi} alt="" />
        <img onMouseUp={(e) => sendReact(e, "pepesad")} src={pepesad} alt="" />
        <img onMouseUp={(e) => sendReact(e, "galaxy")} src={galaxy} alt="" />
        <img onMouseUp={(e) => sendReact(e, "pink")} src={pink} alt="" />
        <img onMouseUp={(e) => sendReact(e, "soy")} src={soy} alt="" />
        <img onMouseUp={(e) => sendReact(e, "cry")} src={cry} alt="" />
        <img onMouseUp={(e) => sendReact(e, "doom")} src={doom} alt="" />
      </div>
    </Modal>
  );
}

export function stringToReact(s: string) {
  const em = (emojis as Record<string, string>)[s.replace(/\:/g, "")];
  if (s === "yeschad")
    return <img className="react-img" src={yeschad} alt="" />;
  if (s === "facepalm")
    return <img className="react-img" src={facepalm} alt="" />;
  if (s === "yes.jpg")
    return <img className="react-img" src={yeschad} alt="" />;
  if (s === "gigachad")
    return <img className="react-img" src={gigachad} alt="" />;
  if (s === "pepechin")
    return <img className="react-img" src={pepechin} alt="" />;
  if (s === "pepeeyes")
    return <img className="react-img" src={pepeeyes} alt="" />;
  if (s === "pepegmi")
    return <img className="react-img" src={pepegmi} alt="" />;
  if (s === "pepesad")
    return <img className="react-img" src={pepesad} alt="" />;
  if (s === "") return <Icon name="emoji" className="react-img no-react" />;
  if (s === "cringe") return <img className="react-img" src={cringe} alt="" />;
  if (s === "cry") return <img className="react-img" src={cry} alt="" />;
  if (s === "crywojak") return <img className="react-img" src={cry} alt="" />;
  if (s === "doom") return <img className="react-img" src={doom} alt="" />;
  if (s === "galaxy") return <img className="react-img" src={galaxy} alt="" />;
  if (s === "pink") return <img className="react-img" src={pink} alt="" />;
  if (s === "pinkwojak") return <img className="react-img" src={pink} alt="" />;
  if (s === "soy") return <img className="react-img" src={soy} alt="" />;
  if (s === "chad") return <img className="react-img" src={chad} alt="" />;
  if (s === "pika") return <img className="react-img" src={pika} alt="" />;
  if (em) return <span className="react-icon">{em}</span>;
  else if (s.length > 2) return <span className="react-icon"></span>;
  else return <span className="react-icon">{s}</span>;
}

export function TrillReactModal({
  user,
  poast,
}: {
  user: UserType;
  poast: Poast;
}) {
  const { api } = useLocalState((s) => ({
    api: s.api,
  }));
  const our = api!.airlock.our!;

  async function sendReact(s: string) {
    const result = await api!.addReact(user, poast.id, s);
    // Only add notification if reacting to someone else's post
    if (result && poast.author !== our) {
      toast.success(`You reacted to ${poast.author}'s post`);
    }
    return result;
  }
  return <ReactModal send={sendReact} />;
}
