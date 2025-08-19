async function loadMatches(){
  const res = await fetch("/api/matches");
  const data = await res.json();
  const list = document.getElementById("matchList");
  list.innerHTML = "";

  data.matches.forEach(m=>{
    const item = document.createElement("a");
    item.className = "item";
    item.href = `/chat/${m.id}`;
    item.innerHTML = `
      <div class="avatar" style="background: radial-gradient(60% 60% at 30% 30%, #FF7A8A, ${m.color});">${m.avatar || "📚"}</div>
      <div class="info">
        <div class="name">${m.id} — ${m.title}</div>
        <div class="preview">${m.lastMessage || ""}</div>
      </div>
    `;
    list.appendChild(item);
  });
}

loadMatches();