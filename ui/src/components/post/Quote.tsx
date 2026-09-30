import type { Poast } from "@/types/trill";
import { date_diff, getThreadPath } from "@/logic/utils";
import { useLocation } from "wouter";
import Body from "./Body";
import Sigil from "../Sigil";
import { usePostUser } from "@/hooks/usePostUser";

function Quote({
  data,
  refetch,
  nest,
}: {
  data: Poast;
  refetch?: Function;
  nest: number;
}) {
  const [_, navigate] = useLocation();
  const userFromPost = usePostUser();
  function gotoQuote(e: React.MouseEvent) {
    e.stopPropagation();
    navigate(getThreadPath(data));
  }
  return (
    <div onClick={gotoQuote} className="quote-in-post">
      <header>
        <div className="quote-author flex">
          <Sigil patp={data.author} size={30} />
          {data.author}
        </div>
        <span>{date_diff(data.time, "short")}</span>
      </header>
      <Body
        user={userFromPost(data)}
        poast={data}
        nest={nest}
        refetch={refetch!}
      />
    </div>
  );
}

export default Quote;
