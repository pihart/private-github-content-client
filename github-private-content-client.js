(root => {
  "use strict";

  function requireValue(value, name) {
    const normalized = String(value || "").trim();
    if (!normalized) throw new Error(`${name} is required.`);
    return normalized;
  }

  function createTokenCreationUrl({ owner, repository, name = "Private repository reader", description, expiresIn = 90 }) {
    const url = new URL("https://github.com/settings/personal-access-tokens/new");
    url.search = new URLSearchParams({
      name,
      description: description || `Read-only browser access to ${owner}/${repository}`,
      target_name: owner,
      expires_in: String(expiresIn),
      contents: "read",
    }).toString();
    return url.toString();
  }

  function createClient(options) {
    const owner = requireValue(options.owner, "owner");
    const repository = requireValue(options.repository, "repository");
    const fetchImpl = options.fetchImpl || root.fetch?.bind(root);
    const storage = options.storage || root.sessionStorage;
    const sessionKey = requireValue(options.sessionKey, "sessionKey");
    if (!fetchImpl) throw new Error("A fetch implementation is required.");
    if (!storage) throw new Error("Session storage is required.");
    let token = "";

    function url(path, query = {}) {
      const requestUrl = new URL(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}${path}`);
      Object.entries(query).forEach(([key, value]) => requestUrl.searchParams.set(key, value));
      return requestUrl;
    }

    async function request(path, { query = {}, accept = "application/vnd.github.raw+json" } = {}) {
      if (!token) throw new Error("A repository token is required.");
      const response = await fetchImpl(url(path, query), {
        headers: { Authorization: `Bearer ${token}`, Accept: accept, "X-GitHub-Api-Version": "2026-03-10" },
        cache: "no-store",
      });
      if ([401, 403, 404].includes(response.status)) throw new Error("GitHub could not read this private repository. Check the token, repository selection, expiration, and Contents permission.");
      if (!response.ok) throw new Error(`GitHub request failed (${response.status}).`);
      return response;
    }

    return Object.freeze({
      owner,
      repository,
      request,
      tokenCreationUrl: settings => createTokenCreationUrl({ owner, repository, ...settings }),
      unlock(value) {
        token = String(value || "").trim();
        if (!token) throw new Error("Enter a fine-grained GitHub token.");
        storage.setItem(sessionKey, token);
      },
      restore() { token = storage.getItem(sessionKey) || ""; return token; },
      lock() { token = ""; storage.removeItem(sessionKey); },
    });
  }

  function bindTokenGate({ client, form, tokenInput, submitButton, tokenLink, status, onUnlock, onError, tokenLinkOptions }) {
    if (tokenLink) tokenLink.href = client.tokenCreationUrl(tokenLinkOptions);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      submitButton.disabled = true;
      try {
        client.unlock(tokenInput.value);
        await onUnlock(token);
        tokenInput.value = "";
      } catch (error) {
        client.lock();
        if (status) status.textContent = "Repository token required";
        if (onError) onError(error);
        submitButton.disabled = false;
      }
    });
    return async () => {
      if (!client.restore()) return false;
      submitButton.disabled = true;
      try { await onUnlock(token); return true; }
      catch (error) {
        client.lock();
        if (status) status.textContent = "Repository token required";
        if (onError) onError(error);
        submitButton.disabled = false;
        return false;
      }
    };
  }

  const api = Object.freeze({ createClient, bindTokenGate, createTokenCreationUrl });
  if (typeof module !== "undefined") module.exports = api;
  root.PrivateGitHubContentClient = api;
})(typeof window === "undefined" ? globalThis : window);
