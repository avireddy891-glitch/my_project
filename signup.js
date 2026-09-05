document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailStr = document.getElementById('email').value;
    const usernameStr = document.getElementById('username').value;
    const passwordStr = document.getElementById('password').value;
    const errorEl = document.getElementById('signup-error');
    const signupBtn = document.querySelector('.btn-login');
    
    // Simple loading state
    signupBtn.innerHTML = '<span class="icon">⌛</span> Creating...';
    signupBtn.style.opacity = '0.7';
    signupBtn.disabled = true;

    try {
        const res = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailStr, username: usernameStr, password: passwordStr })
        });

        const data = await res.json();

        if (res.ok && data.token) {
            // Success! Save token
            localStorage.setItem('auth_token', data.token);
            // Redirect to dashboard
            window.location.href = '/index.html';
        } else {
            // Show error
            errorEl.innerText = data.error || 'Registration Failed';
            errorEl.style.display = 'block';

            // Reset button
            signupBtn.innerHTML = '<span class="btn-icon">🔐</span> Sign Up Free';
            signupBtn.style.opacity = '1';
            signupBtn.disabled = false;
        }
    } catch (err) {
        errorEl.innerText = 'Network error. Make sure the server is running.';
        errorEl.style.display = 'block';

        signupBtn.innerHTML = '<span class="btn-icon">🔐</span> Sign Up Free';
        signupBtn.style.opacity = '1';
        signupBtn.disabled = false;
    }
});
