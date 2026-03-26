import { api, setAuth, getToken } from "./api.js";

// Redirect if already logged in
if (getToken()) window.location.href = "/dashboard.html";

const form = document.getElementById("loginForm") as HTMLFormElement;
const errorEl = document.getElementById("loginError") as HTMLParagraphElement;

form.addEventListener("submit", async (e) => {
	e.preventDefault();
	errorEl.textContent = "";

	const username = (document.getElementById("username") as HTMLInputElement).value;
	const password = (document.getElementById("password") as HTMLInputElement).value;

	try {
		const data = (await api.login(username, password)) as { token: string; user: { id: string; email: string; name: string; role: string } };
		setAuth(data.token, data.user);
		window.location.href = "/dashboard.html";
	} catch (err) {
		errorEl.textContent = (err as Error).message;
	}
});
