export type Member = {
    id: string;
    name: string;
    username: string;
    team: string;
    role: string;
    email: string;
    avatarEmail: string;
    phone: string;
    address1: string;
    address2: string;
    joinDate: string;
    birth: string;
    passportNo: string;
    passportLastName: string;
    passportFirstName: string;
    passportExpiry: string;
    passportExpiryISO: string;
    profilePhotoBucket: string;
    profilePhotoPath: string;
    profilePhotoName: string;
    passportPhotoBucket: string;
    passportPhotoPath: string;
    passportPhotoName: string;
};

export type MembersTab = "ALL" | "ADMIN" | "STAFF";

export type MemberSection = { role: string; members: Member[] };
