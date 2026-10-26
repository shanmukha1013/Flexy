// Legacy demo login (retired).
// The prototype that used this file simulated OTP delivery with a hardcoded
// code and stored fake "token_user_..." sessions in localStorage, on the same
// origin as the real app. Real sign-in is the email OTP flow at /login.html.
(function () {
    var token = localStorage.getItem('flexy_token');
    // Real access tokens are JWTs (three dot-separated parts).
    if (token && token.split('.').length !== 3) {
        localStorage.removeItem('flexy_token');
        localStorage.removeItem('flexy_user');
    }
    sessionStorage.removeItem('temp_otp');
    sessionStorage.removeItem('temp_phone');
    sessionStorage.removeItem('temp_name');
    window.location.replace('/login.html');
})();
