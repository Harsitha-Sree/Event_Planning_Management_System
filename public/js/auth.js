 

const messageDisplay = document.getElementById('message-display'); // Assuming this element exists on both login/register pages

/**
 * Displays a message to the user.
 * @param {string} message - The message text.
 * @param {'success'|'error'} type - The type of message (determines styling).
 */
function displayMessage(message, type) {
    if (messageDisplay) {
        messageDisplay.textContent = message;
        messageDisplay.className = `message ${type}`;
        messageDisplay.style.display = 'block';
    } else {
        console.warn('Message display element not found, logging message instead:', message, type);
        alert(`${type.toUpperCase()}: ${message}`);
    }
}

/**
 * Hides the message display.
 */
function hideMessage() {
    if (messageDisplay) {
        messageDisplay.style.display = 'none';
    }
}


// --- LOGIN PAGE SPECIFIC LOGIC ---
async function initLoginPage() {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('login-button');

    // Crucially, clear any existing token on login page load to ensure a fresh login
    localStorage.removeItem('token');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission
            hideMessage();
            loginButton.disabled = true;
            loginButton.textContent = 'Logging in...';

            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            // Simple client-side validation
            if (!email || !password) {
                displayMessage('Please fill in all fields.', 'error');
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
                return;
            }

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token); // Store JWT token
                    displayMessage(data.message, 'success');

                    // Redirect based on user role
                    setTimeout(() => {
                        switch (data.user.role) {
                            case 'organizer':
                                window.location.href = '/organizer/dashboard.html';
                                break;
                            case 'vendor':
                                window.location.href = '/vendor/dashboard.html';
                                break;
                            case 'admin':
                                window.location.href = '/admin/dashboard.html';
                                break;
                            default:
                                console.warn('Unknown user role, redirecting to default dashboard.');
                                window.location.href = '/index.html'; // Or a generic dashboard if one exists
                                break;
                        }
                    }, 1000); // Redirect after a short delay
                } else {
                    displayMessage(data.message || 'Login failed. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Login error:', error);
                displayMessage('An unexpected error occurred. Please try again later.', 'error');
            } finally {
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            }
        });
    }
}


// --- REGISTER PAGE SPECIFIC LOGIC ---
async function initRegisterPage() {
    const registerForm = document.getElementById('register-form');
    const registerHeading = document.getElementById('register-heading');
    const userRoleInput = document.getElementById('user-role');
    const fullNameInput = document.getElementById('fullName');
    const companyNameGroup = document.getElementById('company-name-group');
    const companyNameInput = document.getElementById('companyName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const registerButton = document.getElementById('register-button');

    // --- Dynamic Role Handling ---
    const urlParams = new URLSearchParams(window.location.search);
    const roleFromUrl = urlParams.get('role');

    if (roleFromUrl && (roleFromUrl === 'organizer' || roleFromUrl === 'vendor')) {
        userRoleInput.value = roleFromUrl;
        registerHeading.innerHTML = `<i class="fas fa-user-plus"></i> Register as ${roleFromUrl.charAt(0).toUpperCase() + roleFromUrl.slice(1)}`;

        if (roleFromUrl === 'vendor') {
            companyNameGroup.style.display = 'block';
            companyNameInput.setAttribute('required', 'true');
        } else {
            companyNameGroup.style.display = 'none';
            companyNameInput.removeAttribute('required');
        }
    } else {
        // Default to organizer if role is not specified or invalid in URL
        userRoleInput.value = 'organizer';
        registerHeading.innerHTML = `<i class="fas fa-user-plus"></i> Register as Organizer`;
        companyNameGroup.style.display = 'none';
        companyNameInput.removeAttribute('required');
    }

    // --- Form Submission Logic ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission
            hideMessage();
            registerButton.disabled = true;
            registerButton.textContent = 'Registering...';

            const fullName = fullNameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            const confirmPassword = confirmPasswordInput.value.trim();
            const role = userRoleInput.value;
            const companyName = role === 'vendor' ? companyNameInput.value.trim() : undefined;

            // Client-side validation
            if (!fullName || !email || !password || !confirmPassword) {
                displayMessage('Please fill in all required fields.', 'error');
                registerButton.disabled = false;
                registerButton.textContent = 'Register';
                return;
            }
            if (role === 'vendor' && !companyName) {
                displayMessage('Please enter your Company / Business Name.', 'error');
                registerButton.disabled = false;
                registerButton.textContent = 'Register';
                return;
            }
            if (password.length < 6) {
                displayMessage('Password must be at least 6 characters long.', 'error');
                registerButton.disabled = false;
                registerButton.textContent = 'Register';
                return;
            }
            if (password !== confirmPassword) {
                displayMessage('Passwords do not match.', 'error');
                registerButton.disabled = false;
                registerButton.textContent = 'Register';
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { // Basic email regex
                displayMessage('Please enter a valid email address.', 'error');
                registerButton.disabled = false;
                registerButton.textContent = 'Register';
                return;
            }

            try {
                const payload = {
                    fullName,
                    email,
                    password,
                    role
                };
                if (role === 'vendor') {
                    payload.companyName = companyName; // Only send if role is vendor
                }

                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.ok) {
                    displayMessage(data.message || 'Registration successful!', 'success');
                    registerForm.reset(); // Clear form
                    setTimeout(() => {
                        window.location.href = '/auth/login.html'; // Redirect to login
                    }, 1500);
                } else {
                    displayMessage(data.message || 'Registration failed. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Registration error:', error);
                displayMessage('An unexpected error occurred. Please try again later.', 'error');
            } finally {
                registerButton.disabled = false;
                registerButton.textContent = 'Register';
            }
        });
    }
}


// --- MAIN INITIALIZATION LOGIC (RUNS ON DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', () => {
    // Determine which authentication page is loaded and initialize its specific logic
    const currentPath = window.location.pathname.split('/').pop();

    if (currentPath === 'login.html') {
        initLoginPage();
    } else if (currentPath === 'register.html') {
        initRegisterPage();
    }
});