import { describe, expect, test } from "bun:test";
import {
  MISTRAL_CONVERSATIONS_URL,
  WEB_SEARCH_LIMITS,
  WebSearchError,
  mistralWebSearch,
  readMistralSearch,
  searchQuery,
  stubWebSearch,
  webSearchConfigured,
  webSearchProvider,
} from "./webSearch";

/** The response in Mistral's websearch guide (studio/agents/agent-tools/websearch), as published. */
const DOCUMENTED_RESPONSE = {
  conversation_id: "conv_06835b734f2776bb80008fa7a309bf5a",
  outputs: [
    {
      type: "tool.execution",
      name: "web_search",
      object: "entry",
      created_at: "2025-05-27T12:59:33.171501Z",
      completed_at: "2025-05-27T12:59:34.828228Z",
      id: "tool_exec_06835b7352be74d38000b3523a0cce2e",
    },
    {
      type: "message.output",
      content: [
        {
          type: "text",
          text: "The last winner of the European Football Cup was Spain, who won the UEFA Euro 2024 by defeating England 2-1 in the final",
        },
        {
          type: "tool_reference",
          tool: "web_search",
          title: "UEFA Euro Winners List from 1960 to today - MARCA in English",
          url: "https://www.marca.com/en/football/uefa-euro/winners.html",
          source: "brave",
        },
        {
          type: "tool_reference",
          tool: "web_search",
          title: "UEFA Euro winners: Know the champions - full list",
          url: "https://www.olympics.com/en/news/uefa-european-championships-euro-winners-list-champions",
          source: "brave",
        },
        {
          type: "tool_reference",
          tool: "web_search",
          title: "Full list of UEFA European Championship winners",
          url: "https://www.givemesport.com/football-european-championship-winners/",
          source: "brave",
        },
        { type: "text", text: "." },
      ],
      object: "entry",
      created_at: "2025-05-27T12:59:35.457474Z",
      completed_at: "2025-05-27T12:59:36.156233Z",
      id: "msg_06835b7377517a3680009b05207112ce",
      agent_id: "ag_06835b734cc47dec8000b5f8f860b672",
      model: "mistral-medium-latest",
      role: "assistant",
    },
  ],
  usage: { prompt_tokens: 188, completion_tokens: 55, total_tokens: 7355, connector_tokens: 7112, connectors: { web_search: 1 } },
  object: "conversation.response",
};

const SPAIN = "The last winner of the European Football Cup was Spain, who won the UEFA Euro 2024 by defeating England 2-1 in the final";

describe("readMistralSearch", () => {
  test("reads the documented response: one result per reference, the text before it as snippet", () => {
    expect(readMistralSearch(DOCUMENTED_RESPONSE, 5)).toEqual([
      {
        title: "UEFA Euro Winners List from 1960 to today - MARCA in English",
        site: "marca.com",
        url: "https://www.marca.com/en/football/uefa-euro/winners.html",
        snippet: SPAIN,
      },
      {
        title: "UEFA Euro winners: Know the champions - full list",
        site: "olympics.com",
        url: "https://www.olympics.com/en/news/uefa-european-championships-euro-winners-list-champions",
        snippet: SPAIN,
      },
      {
        title: "Full list of UEFA European Championship winners",
        site: "givemesport.com",
        url: "https://www.givemesport.com/football-european-championship-winners/",
        snippet: SPAIN,
      },
    ]);
  });

  test("at most maxResults, and never more than the adapter's own cap", () => {
    expect(readMistralSearch(DOCUMENTED_RESPONSE, 2)).toHaveLength(2);
    const many = {
      outputs: [
        {
          type: "message.output",
          content: Array.from({ length: 12 }, (_, i) => ({
            type: "tool_reference",
            tool: "web_search",
            title: `Page ${i}`,
            url: `https://example.com/${i}`,
          })),
        },
      ],
    };
    expect(readMistralSearch(many, 50)).toHaveLength(WEB_SEARCH_LIMITS.maxResults);
  });

  test("drops links that are not http(s), repeats, other tools and untitled references; strips credentials", () => {
    const json = {
      outputs: [
        {
          type: "message.output",
          content: [
            { type: "text", text: "First claim" },
            { type: "tool_reference", tool: "web_search", title: "Bad", url: "javascript:alert(1)" },
            { type: "tool_reference", tool: "web_search", title: "Relative", url: "/path" },
            { type: "tool_reference", tool: "document_library", title: "Doc", url: "https://docs.example/a" },
            { type: "tool_reference", tool: "web_search", title: "  ", url: "https://untitled.example/" },
            { type: "tool_reference", tool: "web_search", title: "Good", url: "https://user:pw@good.example/a" },
            { type: "tool_reference", tool: "web_search_premium", title: "Again", url: "https://good.example/a" },
            { type: "text", text: " Second claim" },
            { type: "tool_reference", tool: "web_search_premium", title: "News", url: "http://news.example/b", description: "A  described\npage." },
          ],
        },
      ],
    };
    expect(readMistralSearch(json, 5)).toEqual([
      { title: "Good", site: "good.example", url: "https://good.example/a", snippet: "First claim" },
      { title: "News", site: "news.example", url: "http://news.example/b", snippet: "A described page." },
    ]);
  });

  test("a plain-string answer has no references; a body that is not a conversation response is bad_response", () => {
    expect(readMistralSearch({ outputs: [{ type: "message.output", content: "Just text." }] }, 5)).toEqual([]);
    expect(() => readMistralSearch({ error: "x" }, 5)).toThrow(WebSearchError);
    expect(() => readMistralSearch(null, 5)).toThrow("bad_response");
  });

  test("long titles and snippets are cut with a visible ellipsis", () => {
    const json = {
      outputs: [
        {
          type: "message.output",
          content: [
            { type: "text", text: `start ${"word ".repeat(200)}end` },
            { type: "tool_reference", tool: "web_search", title: "T".repeat(500), url: "https://example.com/" },
          ],
        },
      ],
    };
    const [result] = readMistralSearch(json, 5);
    expect(result?.title.length).toBe(WEB_SEARCH_LIMITS.titleChars);
    expect(result?.title.endsWith("…")).toBe(true);
    expect(result?.snippet.startsWith("…")).toBe(true);
    expect(result?.snippet.endsWith("end")).toBe(true);
    expect((result?.snippet.length ?? 0) <= WEB_SEARCH_LIMITS.snippetChars).toBe(true);
  });
});

describe("searchQuery", () => {
  test("one line, at most queryChars; nothing to search for is null", () => {
    expect(searchQuery("  city\n library  hours ")).toBe("city library hours");
    expect(searchQuery("x")).toBeNull();
    expect(searchQuery(42)).toBeNull();
    expect(searchQuery("q".repeat(500))?.length).toBe(WEB_SEARCH_LIMITS.queryChars);
  });
});

describe("the Mistral provider", () => {
  function fakeFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fn = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return respond(String(url), init ?? {});
    }) as unknown as typeof fetch;
    return { fn, calls };
  }

  test("sends one Conversations request with the web_search tool, not stored, and reads its references", async () => {
    const http = fakeFetch(() => new Response(JSON.stringify(DOCUMENTED_RESPONSE), { status: 200 }));
    const results = await mistralWebSearch("test-key", http.fn).search(" who won  the last Euro ", { maxResults: 2 });
    expect(results.map((r) => r.site)).toEqual(["marca.com", "olympics.com"]);
    expect(http.calls).toHaveLength(1);
    expect(http.calls[0]?.url).toBe(MISTRAL_CONVERSATIONS_URL);
    expect(http.calls[0]?.init.method).toBe("POST");
    const body = JSON.parse(String(http.calls[0]?.init.body));
    expect(body).toMatchObject({
      model: "mistral-small-latest",
      inputs: [{ role: "user", content: "who won the last Euro" }],
      tools: [{ type: "web_search" }],
      stream: false,
      store: false,
    });
    expect(JSON.stringify(body)).not.toContain("test-key");
  });

  test("an empty query is not sent", async () => {
    const http = fakeFetch(() => new Response("{}"));
    expect(await mistralWebSearch("test-key", http.fn).search("  ", { maxResults: 5 })).toEqual([]);
    expect(http.calls).toHaveLength(0);
  });

  test("errors carry a kind only, never the key, the query or the provider's text", async () => {
    const cases: Array<[number, string]> = [
      [401, "auth"],
      [403, "auth"],
      [429, "rate_limited"],
      [500, "upstream"],
    ];
    for (const [status, kind] of cases) {
      const http = fakeFetch(() => new Response("provider says secret things", { status }));
      const error = await mistralWebSearch("test-key", http.fn)
        .search("private query", { maxResults: 5 })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(WebSearchError);
      expect((error as WebSearchError).kind).toBe(kind);
      const message = (error as Error).message;
      for (const leak of ["test-key", "private query", "provider says"]) expect(message).not.toContain(leak);
    }
    const offline = fakeFetch(() => {
      throw new TypeError("connect ECONNREFUSED");
    });
    const network = await mistralWebSearch("test-key", offline.fn).search("q q", { maxResults: 5 }).catch((e: unknown) => e);
    expect((network as WebSearchError).kind).toBe("network");
    const garbled = fakeFetch(() => new Response("not json", { status: 200 }));
    const bad = await mistralWebSearch("test-key", garbled.fn).search("q q", { maxResults: 5 }).catch((e: unknown) => e);
    expect((bad as WebSearchError).kind).toBe("bad_response");
  });
});

describe("webSearchProvider", () => {
  test("null without MISTRAL_API_KEY; a provider with it", () => {
    expect(webSearchProvider({})).toBeNull();
    expect(webSearchProvider({ MISTRAL_API_KEY: "  " })).toBeNull();
    expect(webSearchConfigured({})).toBe(false);
    expect(webSearchProvider({ MISTRAL_API_KEY: "test-key" })).not.toBeNull();
    expect(webSearchConfigured({ MISTRAL_API_KEY: "test-key" })).toBe(true);
  });
});

describe("stubWebSearch", () => {
  test("records calls and answers with its results, at most maxResults", async () => {
    const stub = stubWebSearch([
      { title: "a", site: "a.example", url: "https://a.example/", snippet: "" },
      { title: "b", site: "b.example", url: "https://b.example/", snippet: "" },
    ]);
    expect(await stub.provider.search("q", { maxResults: 1 })).toHaveLength(1);
    expect(stub.calls).toEqual([{ query: "q", maxResults: 1 }]);
  });
});
