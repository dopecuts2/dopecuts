// dopekuts/app/admin/contact/page.tsx
'use client';
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  UserPlus,
  Trash2,
  Search,
  ArrowUpDown,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import {
  getAllContacts,
  createContact,
  updateContact,
  deleteContact,
  IContact,
  ContactData,
} from '../../../lib/api/contact';

// The component's internal representation of a customer
interface Customer {
  id: string; // Changed to string to match MongoDB's _id
  fullName: string;
  email: string;
  phone: string;
  dateAdded: string; // Represents the createdAt date from the API
}

// Validation errors state
interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
}

// --- Reusable Delete Confirmation Dialog ---
const DeleteConfirmationDialog = ({
  open,
  onOpenChange,
  onConfirm,
  customerName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  customerName: string;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
          Confirm Deletion
        </DialogTitle>
        <DialogDescription className="text-gray-400 pt-2">
          Are you sure you want to delete the contact for{' '}
          <span className="font-semibold text-white">{customerName}</span>? This
          action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="mt-4">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="border-gray-600 text-gray-300 hover:bg-gray-700"
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          className="bg-red-600 text-white hover:bg-red-700"
        >
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default function ContactManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'fullName' | 'dateAdded'>(
    'dateAdded'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Partial<Customer>>({
    fullName: '',
    email: '',
    phone: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(
    null
  );

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const contactsFromApi = await getAllContacts();
      const formattedCustomers = contactsFromApi.map(contact => ({
        id: contact._id,
        fullName: contact.name,
        email: contact.email,
        phone: contact.phone,
        dateAdded: contact.createdAt,
      }));
      setCustomers(formattedCustomers);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
      setError('Failed to load customer data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!currentCustomer.fullName?.trim()) {
      errors.fullName = 'Full name is required.';
    }
    if (!currentCustomer.email?.trim()) {
      errors.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(currentCustomer.email)) {
      errors.email = 'Email address is invalid.';
    }
    if (!currentCustomer.phone?.trim()) {
      errors.phone = 'Phone number is required.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSort = (field: 'fullName' | 'dateAdded') => {
    setSortField(field);
    setSortOrder(
      sortField === field && sortOrder === 'asc' ? 'desc' : 'asc'
    );
  };

  const filteredAndSortedCustomers = customers
    .filter(
      customer =>
        customer.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone.includes(searchQuery)
    )
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (sortOrder === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

  const handleOpenAddDialog = () => {
    setIsEditing(false);
    setCurrentCustomer({ fullName: '', email: '', phone: '' });
    setFormErrors({});
    setIsFormDialogOpen(true);
  };

  const handleOpenEditDialog = (customer: Customer) => {
    setIsEditing(true);
    setCurrentCustomer(customer);
    setFormErrors({});
    setIsFormDialogOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!validateForm()) {
      return;
    }
    const contactData: ContactData = {
      name: currentCustomer.fullName!,
      email: currentCustomer.email!,
      phone: currentCustomer.phone!,
    };
    try {
      if (isEditing && currentCustomer.id) {
        await updateContact(currentCustomer.id, contactData);
      } else {
        await createContact(contactData);
      }
      setIsFormDialogOpen(false);
      fetchContacts();
    } catch (err) {
      console.error('Failed to save customer:', err);
      setError('Failed to save customer. Please try again.');
    }
  };

  const handleOpenDeleteDialog = (customer: Customer) => {
    setCustomerToDelete(customer);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    try {
      await deleteContact(customerToDelete.id);
      setCustomers(customers.filter(c => c.id !== customerToDelete.id));
    } catch (err) {
      console.error('Failed to delete customer:', err);
      setError('Failed to delete customer. Please try again.');
    } finally {
      setIsDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Customer Database
          </h1>
          <p className="text-sm md:text-base text-gray-400">
            Manage DopeCuts customers
          </p>
        </div>
        <Button
          onClick={handleOpenAddDialog}
          className="bg-white text-black hover:bg-gray-200 w-full sm:w-auto"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add New Customer
        </Button>
      </div>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {isEditing ? 'Edit Customer' : 'Add New Customer'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {isEditing
                ? 'Update the customer information below.'
                : 'Enter customer information to add them to the database.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-gray-300">
                Full Name
              </Label>
              <Input
                id="fullName"
                placeholder="Enter full name"
                value={currentCustomer.fullName}
                onChange={e =>
                  setCurrentCustomer({
                    ...currentCustomer,
                    fullName: e.target.value,
                  })
                }
                className={`bg-gray-700 border-gray-600 text-white ${
                  formErrors.fullName ? 'border-red-500' : ''
                }`}
              />
              {formErrors.fullName && (
                <p className="text-red-500 text-xs mt-1">
                  {formErrors.fullName}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@email.com"
                value={currentCustomer.email}
                onChange={e =>
                  setCurrentCustomer({
                    ...currentCustomer,
                    email: e.target.value,
                  })
                }
                className={`bg-gray-700 border-gray-600 text-white ${
                  formErrors.email ? 'border-red-500' : ''
                }`}
              />
              {formErrors.email && (
                <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-300">
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={currentCustomer.phone}
                onChange={e =>
                  setCurrentCustomer({
                    ...currentCustomer,
                    phone: e.target.value,
                  })
                }
                className={`bg-gray-700 border-gray-600 text-white ${
                  formErrors.phone ? 'border-red-500' : ''
                }`}
              />
              {formErrors.phone && (
                <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>
              )}
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsFormDialogOpen(false)}
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCustomer}
                className="flex-1 bg-white text-black hover:bg-gray-200"
              >
                {isEditing ? 'Save Changes' : 'Add Customer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        customerName={customerToDelete?.fullName || ''}
      />

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Customers</CardTitle>
          <CardDescription className="text-gray-300">
            Total customers: {customers.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <Select
                value={`${sortField}-${sortOrder}`}
                onValueChange={value => {
                  const [field, order] = value.split('-') as [
                    'fullName' | 'dateAdded',
                    'asc' | 'desc'
                  ];
                  setSortField(field);
                  setSortOrder(order);
                }}
              >
                <SelectTrigger className="w-full sm:w-[200px] bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="dateAdded-desc" className="text-white">
                    Date Added (Newest)
                  </SelectItem>
                  <SelectItem value="dateAdded-asc" className="text-white">
                    Date Added (Oldest)
                  </SelectItem>
                  <SelectItem value="fullName-asc" className="text-white">
                    Name (A-Z)
                  </SelectItem>
                  <SelectItem value="fullName-desc" className="text-white">
                    Name (Z-A)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div className="hidden md:block rounded-md border border-gray-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-750 border-gray-700 hover:bg-gray-750">
                    <TableHead
                      className="text-gray-300 cursor-pointer"
                      onClick={() => handleSort('fullName')}
                    >
                      <div className="flex items-center">
                        Full Name
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="text-gray-300">Email</TableHead>
                    <TableHead className="text-gray-300">Phone</TableHead>
                    <TableHead
                      className="text-gray-300 cursor-pointer"
                      onClick={() => handleSort('dateAdded')}
                    >
                      <div className="flex items-center">
                        Date Added
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="text-gray-300 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 py-12">
                        Loading customers...
                      </TableCell>
                    </TableRow>
                  ) : filteredAndSortedCustomers.length > 0 ? (
                    filteredAndSortedCustomers.map(customer => (
                      <TableRow
                        key={customer.id}
                        className="border-gray-700 hover:bg-gray-750"
                      >
                        <TableCell className="font-medium text-white">
                          {customer.fullName}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {customer.email}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {customer.phone}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {new Date(customer.dateAdded).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }
                          )}
                        </TableCell>
                        <TableCell className="text-right flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditDialog(customer)}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-600/20"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDeleteDialog(customer)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-600/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : null}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden space-y-3">
              {isLoading ? (
                 <div className="text-center py-12 text-gray-400">Loading customers...</div>
              ) : filteredAndSortedCustomers.length > 0 ? (
                filteredAndSortedCustomers.map(customer => (
                  <Card
                    key={customer.id}
                    className="bg-gray-700 border-gray-600"
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-white text-lg">
                            {customer.fullName}
                          </h3>
                          <p className="text-sm text-gray-400">
                            Added{' '}
                            {new Date(customer.dateAdded).toLocaleDateString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              }
                            )}
                          </p>
                        </div>
                        <div className="flex">
                           <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditDialog(customer)}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-600/20"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDeleteDialog(customer)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-600/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-300">
                          <span className="text-gray-400">Email:</span>{' '}
                          {customer.email}
                        </p>
                        <p className="text-gray-300">
                          <span className="text-gray-400">Phone:</span>{' '}
                          {customer.phone}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ): null}
            </div>
            {!isLoading && filteredAndSortedCustomers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400">
                  {searchQuery ? 'No customers found matching your search.' : 'No customers found. Try adding one!'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}