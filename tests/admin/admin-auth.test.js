import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as AdminAuth from '../../scripts/modules/admin/auth.js';
import FirebaseApi from '../../scripts/modules/firebase-api.js';
import Util from '../../scripts/modules/util.js';

vi.mock('../../scripts/modules/firebase-api.js', () => ({
    default: {
        getFirebase: vi.fn()
    }
}));

vi.mock('../../scripts/modules/util.js', () => ({
    default: {
        setCookie: vi.fn(),
        getCookie: vi.fn(),
        eraseCookie: vi.fn()
    }
}));

describe('Admin Auth Module', () => {
    let authMock;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="login-page">
                <input type="password" />
                <input type="checkbox" name="rememberme" />
                <button>Login</button>
            </div>
            <div class="data" style="display:none"></div>
            <button class="logout"></button>
        `;

        authMock = {
            signInWithEmailAndPassword: vi.fn(() => Promise.resolve())
        };

        FirebaseApi.getFirebase.mockReturnValue({
            auth: () => authMock
        });

        vi.clearAllMocks();
    });

    describe('tryLogin', () => {
        it('should call signInWithEmailAndPassword and handle success', async () => {
            AdminAuth.tryLogin('test-password');
            
            expect(authMock.signInWithEmailAndPassword).toHaveBeenCalledWith("rakeshmalik91@gmail.com", 'test-password');
            
            // Multiple ticks for promise chain
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            
            expect($('#login-page').css('display')).toBe('none');
            expect($('.data').css('display')).not.toBe('none');
        });

        it('should set cookie if rememberme is checked', async () => {
            $('#login-page input[name=rememberme]').prop('checked', true);
            
            AdminAuth.tryLogin('test-password');
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            
            expect(Util.setCookie).toHaveBeenCalledWith("credentials", "test-password", 7);
        });

        it('should alert on login failure', async () => {
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            authMock.signInWithEmailAndPassword.mockReturnValue(Promise.reject({ message: 'Login failed' }));
            
            AdminAuth.tryLogin('wrong-password');
            
            // Multiple ticks for reject and catch
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            
            expect(alertSpy).toHaveBeenCalledWith('Login failed');
            alertSpy.mockRestore();
        });
    });

    describe('setupAuthListeners', () => {
        it('should try auto-login if cookie exists', () => {
            vi.useFakeTimers();
            Util.getCookie.mockReturnValue('saved-password');
            authMock.signInWithEmailAndPassword.mockReturnValue(Promise.resolve());

            AdminAuth.setupAuthListeners();
            
            vi.advanceTimersByTime(1100);
            expect(authMock.signInWithEmailAndPassword).toHaveBeenCalledWith("rakeshmalik91@gmail.com", 'saved-password');
            vi.useRealTimers();
        });

        it('should trigger login on button click', () => {
            $('#login-page input[type=password]').val('clicked-password');
            AdminAuth.setupAuthListeners();
            
            $('#login-page button').click();
            expect(authMock.signInWithEmailAndPassword).toHaveBeenCalledWith("rakeshmalik91@gmail.com", 'clicked-password');
        });

        it('should trigger login on Enter keypress', () => {
            $('#login-page input[type=password]').val('entered-password');
            AdminAuth.setupAuthListeners();
            
            const event = $.Event('keypress', { code: 'Enter' });
            $('#login-page input').trigger(event);
            
            expect(authMock.signInWithEmailAndPassword).toHaveBeenCalledWith("rakeshmalik91@gmail.com", 'entered-password');
        });

        it('should ignore other keys', () => {
            AdminAuth.setupAuthListeners();
            const event = $.Event('keypress', { code: 'Space' });
            $('#login-page input').trigger(event);
            expect(authMock.signInWithEmailAndPassword).not.toHaveBeenCalled();
        });

        it('should handle logout click', () => {
            // Mock location.reload
            const reloadSpy = vi.fn();
            Object.defineProperty(window, 'location', {
                value: { reload: reloadSpy },
                writable: true
            });

            AdminAuth.setupAuthListeners();
            $('button.logout').click();
            
            expect(Util.eraseCookie).toHaveBeenCalledWith("credentials");
            expect(reloadSpy).toHaveBeenCalled();
        });
    });
});
