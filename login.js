document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameStr = document.getElementById('username').value;
    const passwordStr = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    const loginBtn = document.querySelector('.btn-login');
    // Simple loading state
    loginBtn.innerHTML = '<span class="icon">⌛</span> Logging in...';
    loginBtn.style.opacity = '0.7';
    loginBtn.disabled = true;

    try {
        // We will call the backend API using relative path since the frontend is now served by backend
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameStr, password: passwordStr })
        });

        const data = await res.json();

        if (res.ok && data.token) {
            // Success! Save token
            localStorage.setItem('auth_token', data.token);
            // Redirect to dashboard
            window.location.href = '/index.html';
        } else {
            // Show error
            errorEl.innerText = data.error || 'Invalid username or password';
            errorEl.style.display = 'block';

            // Reset button
            loginBtn.innerHTML = '<span class="btn-icon">🔓</span> Login Securely';
            loginBtn.style.opacity = '1';
            loginBtn.disabled = false;
        }
    } catch (err) {
        errorEl.innerText = 'Network error. Make sure the server is running.';
        errorEl.style.display = 'block';

        loginBtn.innerHTML = '<span class="btn-icon">🔓</span> Login Securely';
        loginBtn.style.opacity = '1';
        loginBtn.disabled = false;
    }
});
