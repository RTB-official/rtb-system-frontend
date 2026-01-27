// React import 제거: 최신 JSX 런타임 사용

export const IconRTBLogo = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <rect x="2" y="4" width="20" height="16" rx="3" fill="#111827" />
        <path
            d="M7 8H17"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M7 12H13"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export const IconCalendar = (props: { className?: string }) => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M8 18C7.71667 18 7.479 17.904 7.287 17.712C7.09567 17.5207 7 17.2833 7 17C7 16.7167 7.09567 16.4793 7.287 16.288C7.479 16.096 7.71667 16 8 16C8.28333 16 8.521 16.096 8.713 16.288C8.90433 16.4793 9 16.7167 9 17C9 17.2833 8.90433 17.5207 8.713 17.712C8.521 17.904 8.28333 18 8 18ZM8 14C7.71667 14 7.479 13.904 7.287 13.712C7.09567 13.5207 7 13.2833 7 13C7 12.7167 7.09567 12.479 7.287 12.287C7.479 12.0957 7.71667 12 8 12C8.28333 12 8.521 12.0957 8.713 12.287C8.90433 12.479 9 12.7167 9 13C9 13.2833 8.90433 13.5207 8.713 13.712C8.521 13.904 8.28333 14 8 14ZM12 18C11.7167 18 11.4793 17.904 11.288 17.712C11.096 17.5207 11 17.2833 11 17C11 16.7167 11.096 16.4793 11.288 16.288C11.4793 16.096 11.7167 16 12 16C12.2833 16 12.521 16.096 12.713 16.288C12.9043 16.4793 13 16.7167 13 17C13 17.2833 12.9043 17.5207 12.713 17.712C12.521 17.904 12.2833 18 12 18ZM12 14C11.7167 14 11.4793 13.904 11.288 13.712C11.096 13.5207 11 13.2833 11 13C11 12.7167 11.096 12.479 11.288 12.287C11.4793 12.0957 11.7167 12 12 12C12.2833 12 12.521 12.0957 12.713 12.287C12.9043 12.479 13 12.7167 13 13C13 13.2833 12.9043 13.5207 12.713 13.712C12.521 13.904 12.2833 14 12 14ZM16 18C15.7167 18 15.4793 17.904 15.288 17.712C15.096 17.5207 15 17.2833 15 17C15 16.7167 15.096 16.4793 15.288 16.288C15.4793 16.096 15.7167 16 16 16C16.2833 16 16.5207 16.096 16.712 16.288C16.904 16.4793 17 16.7167 17 17C17 17.2833 16.904 17.5207 16.712 17.712C16.5207 17.904 16.2833 18 16 18ZM16 14C15.7167 14 15.4793 13.904 15.288 13.712C15.096 13.5207 15 13.2833 15 13C15 12.7167 15.096 12.479 15.288 12.287C15.4793 12.0957 15.7167 12 16 12C16.2833 12 16.5207 12.0957 16.712 12.287C16.904 12.479 17 12.7167 17 13C17 13.2833 16.904 13.5207 16.712 13.712C16.5207 13.904 16.2833 14 16 14ZM5 22C4.45 22 3.979 21.8043 3.587 21.413C3.19567 21.021 3 20.55 3 20V6C3 5.45 3.19567 4.97933 3.587 4.588C3.979 4.196 4.45 4 5 4H6V2H8V4H16V2H18V4H19C19.55 4 20.021 4.196 20.413 4.588C20.8043 4.97933 21 5.45 21 6V20C21 20.55 20.8043 21.021 20.413 21.413C20.021 21.8043 19.55 22 19 22H5ZM5 20H19V10H5V20ZM5 8H19V6H5V8Z"
            fill="currentColor"
        />
    </svg>
);

export const IconUpload = (props: { className?: string }) => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <g clipPath="url(#clip0_1399_4704)">
            <path
                d="M18 15V18H6V15H4V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V15H18ZM7 9L8.41 10.41L11 7.83V16H13V7.83L15.59 10.41L17 9L12 4L7 9Z"
                fill="#1E2939"
            />
        </g>
        <defs>
            <clipPath id="clip0_1399_4704">
                <rect width="24" height="24" fill="white" />
            </clipPath>
        </defs>
    </svg>
);

export const IconPayment = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <rect
            x="2"
            y="5"
            width="20"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
        />
        <rect
            x="3.5"
            y="8.5"
            width="6"
            height="2"
            rx="0.5"
            fill="currentColor"
        />
    </svg>
);

export const IconCard = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 -960 960 960"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M240-160q-66 0-113-47T80-320v-320q0-66 47-113t113-47h480q66 0 113 47t47 113v320q0 66-47 113t-113 47H240Zm0-480h480q22 0 42 5t38 16v-21q0-33-23.5-56.5T720-720H240q-33 0-56.5 23.5T160-640v21q18-11 38-16t42-5Zm-74 130 445 108q9 2 18 0t17-8l139-116q-11-15-28-24.5t-37-9.5H240q-26 0-45.5 13.5T166-510Z" />
    </svg>
);

export const IconCar = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 -960 960 960"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M240-200v40q0 17-11.5 28.5T200-120h-40q-17 0-28.5-11.5T120-160v-320l84-240q6-18 21.5-29t34.5-11h440q19 0 34.5 11t21.5 29l84 240v320q0 17-11.5 28.5T800-120h-40q-17 0-28.5-11.5T720-160v-40H240Zm-8-360h496l-42-120H274l-42 120Zm68 240q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Z" />
    </svg>
);

export const IconClock = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
        />
        <path
            d="M12 6v6l4 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export const IconEdit = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M4.16667 15.8333H5.35417L13.5 7.6875L12.3125 6.5L4.16667 14.6458V15.8333ZM2.5 17.5V13.9583L13.5 2.97917C13.6667 2.82639 13.8507 2.70833 14.0521 2.625C14.2535 2.54167 14.4653 2.5 14.6875 2.5C14.9097 2.5 15.125 2.54167 15.3333 2.625C15.5417 2.70833 15.7222 2.83333 15.875 3L17.0208 4.16667C17.1875 4.31944 17.309 4.5 17.3854 4.70833C17.4618 4.91667 17.5 5.125 17.5 5.33333C17.5 5.55556 17.4618 5.76736 17.3854 5.96875C17.309 6.17014 17.1875 6.35417 17.0208 6.52083L6.04167 17.5H2.5ZM12.8958 7.10417L12.3125 6.5L13.5 7.6875L12.8958 7.10417Z"
            fill="currentColor"
        />
    </svg>
);

export const IconTrash = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M5.83325 17.5C5.37492 17.5 4.9827 17.3369 4.65659 17.0108C4.32992 16.6842 4.16659 16.2917 4.16659 15.8333V5H3.33325V3.33333H7.49992V2.5H12.4999V3.33333H16.6666V5H15.8333V15.8333C15.8333 16.2917 15.6702 16.6842 15.3441 17.0108C15.0174 17.3369 14.6249 17.5 14.1666 17.5H5.83325ZM14.1666 5H5.83325V15.8333H14.1666V5ZM7.49992 14.1667H9.16659V6.66667H7.49992V14.1667ZM10.8333 14.1667H12.4999V6.66667H10.8333V14.1667Z"
            fill="currentColor"
        />
    </svg>
);

export const IconDownload = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M5.00016 16.6663C4.54183 16.6663 4.14961 16.5033 3.8235 16.1772C3.49683 15.8505 3.3335 15.458 3.3335 14.9997V12.4997H5.00016V14.9997H15.0002V12.4997H16.6668V14.9997C16.6668 15.458 16.5038 15.8505 16.1777 16.1772C15.851 16.5033 15.4585 16.6663 15.0002 16.6663H5.00016ZM10.0002 13.333L5.8335 9.16634L7.00016 7.95801L9.16683 10.1247V3.33301H10.8335V10.1247L13.0002 7.95801L14.1668 9.16634L10.0002 13.333Z"
            fill="currentColor"
        />
    </svg>
);

export const IconLock = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
    >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
);

export const IconEye = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

export const IconEyeOff = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);

export const IconLogout = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
    >
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
    </svg>
);

export const IconStar = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
);

export const IconChevronLeft = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M15 18l-6-6 6-6" />
    </svg>
);

export const IconChevronRight = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M9 18l6-6-6-6" />
    </svg>
);

export const IconMenu = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
    >
        <path d="M4 6H20M4 12H20M4 18H20" />
    </svg>
);

export const IconPerson = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

export const IconHome = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z"
            fill="currentColor"
        />
    </svg>
);

export const IconReport = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z"
            fill="currentColor"
        />
    </svg>
);

export const IconWorkload = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17Z"
            fill="currentColor"
        />
    </svg>
);

export const IconVacation = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 -960 960 960"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="m397-115-99-184-184-99 71-70 145 25 102-102-317-135 84-86 385 68 124-124q23-23 57-23t57 23q23 23 23 56.5T822-709L697-584l68 384-85 85-136-317-102 102 26 144-71 71Z" />
    </svg>
);

export const IconUmbrella = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M12 2C8.13 2 5 5.13 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.13 15.87 2 12 2ZM14 13.7V16H10V13.7C8.84 13.19 8 12.2 8 11C8 9.34 9.34 8 11 8H13C14.66 8 16 9.34 16 11C16 12.2 15.16 13.19 14 13.7Z"
            fill="currentColor"
        />
    </svg>
);

export const IconMembers = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V19H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V19H23V16.5C23 14.17 18.33 13 16 13Z"
            fill="currentColor"
        />
    </svg>
);

export const IconNotifications = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.37 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.64 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z"
            fill="currentColor"
        />
    </svg>
);

export const IconClose = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
            fill="currentColor"
        />
    </svg>
);

export const IconCheck = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M20 6L9 17l-5-5" />
    </svg>
);

export const IconCheckmark = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export const IconError = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

export const IconInfo = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

export const IconArrowBack = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
            fill="currentColor"
        />
    </svg>
);

export const IconPlus = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <g clipPath="url(#clip0_plus)">
            <path
                d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"
                fill="currentColor"
            />
        </g>
        <defs>
            <clipPath id="clip0_plus">
                <rect width="24" height="24" fill="white" />
            </clipPath>
        </defs>
    </svg>
);

export const IconMore = (props: { className?: string }) => (
    <svg
        className={props.className || "w-5 h-5"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M6 10C4.9 10 4 10.9 4 12C4 13.1 4.9 14 6 14C7.1 14 8 13.1 8 12C8 10.9 7.1 10 6 10ZM18 10C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14C19.1 14 20 13.1 20 12C20 10.9 19.1 10 18 10ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z"
            fill="currentColor"
        />
    </svg>
);

export const IconAirplane = (props: { className?: string }) => (
    <svg
        className={props.className || "w-4 h-4"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M21.5 12L18.5 11L13.5 6C13.5 5.17 12.83 4.5 12 4.5H11C10.17 4.5 9.5 5.17 9.5 6L9.5 9L4.5 11L2.5 12L4.5 13L9.5 15V19L7.5 21L6.5 22L12 21L17.5 22L16.5 21L14.5 19V15L19.5 13L21.5 12Z"
            fill="currentColor"
        />
    </svg>
);

export const IconSettings = (props: { className?: string }) => (
    <svg
        className={props.className || "w-6 h-6"}
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <g clipPath="url(#clip0_settings)">
            <path
                d="M19.1401 12.9404C19.1801 12.6404 19.2001 12.3304 19.2001 12.0004C19.2001 11.6804 19.1801 11.3604 19.1301 11.0604L21.1601 9.48039C21.3401 9.34039 21.3901 9.07039 21.2801 8.87039L19.3601 5.55039C19.2401 5.33039 18.9901 5.26039 18.7701 5.33039L16.3801 6.29039C15.8801 5.91039 15.3501 5.59039 14.7601 5.35039L14.4001 2.81039C14.3601 2.57039 14.1601 2.40039 13.9201 2.40039H10.0801C9.84011 2.40039 9.65011 2.57039 9.61011 2.81039L9.25011 5.35039C8.66011 5.59039 8.12011 5.92039 7.63011 6.29039L5.24011 5.33039C5.02011 5.25039 4.77011 5.33039 4.65011 5.55039L2.74011 8.87039C2.62011 9.08039 2.66011 9.34039 2.86011 9.48039L4.89011 11.0604C4.84011 11.3604 4.80011 11.6904 4.80011 12.0004C4.80011 12.3104 4.82011 12.6404 4.87011 12.9404L2.84011 14.5204C2.66011 14.6604 2.61011 14.9304 2.72011 15.1304L4.64011 18.4504C4.76011 18.6704 5.01011 18.7404 5.23011 18.6704L7.62011 17.7104C8.12011 18.0904 8.65011 18.4104 9.24011 18.6504L9.60011 21.1904C9.65011 21.4304 9.84011 21.6004 10.0801 21.6004H13.9201C14.1601 21.6004 14.3601 21.4304 14.3901 21.1904L14.7501 18.6504C15.3401 18.4104 15.8801 18.0904 16.3701 17.7104L18.7601 18.6704C18.9801 18.7504 19.2301 18.6704 19.3501 18.4504L21.2701 15.1304C21.3901 14.9104 21.3401 14.6604 21.1501 14.5204L19.1401 12.9404ZM12.0001 15.6004C10.0201 15.6004 8.40011 13.9804 8.40011 12.0004C8.40011 10.0204 10.0201 8.40039 12.0001 8.40039C13.9801 8.40039 15.6001 10.0204 15.6001 12.0004C15.6001 13.9804 13.9801 15.6004 12.0001 15.6004Z"
                fill="currentColor"
            />
        </g>
        <defs>
            <clipPath id="clip0_settings">
                <rect width="24" height="24" fill="white" />
            </clipPath>
        </defs>
    </svg>
);

